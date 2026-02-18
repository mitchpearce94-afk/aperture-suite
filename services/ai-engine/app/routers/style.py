"""
Style Profile API routes — create, train, and manage style profiles.
v3.0: Adds GPU neural LUT training via Modal alongside existing CPU histogram.
"""
import logging
import os
import httpx
from threading import Thread
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.workers.style_trainer import train_profile
from app.storage.db import get_style_profile, validate_style_profile_ownership, update_style_profile
from app.config import get_supabase, get_settings

router = APIRouter()
log = logging.getLogger(__name__)

MODAL_BASE_URL = os.environ.get("MODAL_BASE_URL", "")


def _modal_endpoint(function_name: str) -> str:
    """Build Modal endpoint URL for a given function."""
    if not MODAL_BASE_URL:
        return ""
    parts = MODAL_BASE_URL.rsplit("--", 1)
    if len(parts) == 2:
        return f"{parts[0]}--apelier-gpu-{function_name.replace('_', '-')}.modal.run"
    return f"{MODAL_BASE_URL}/{function_name}"


class StyleProfileCreate(BaseModel):
    photographer_id: str
    name: str
    description: Optional[str] = None
    reference_image_keys: list[str] = []
    settings: Optional[dict] = None
    preset_file_key: Optional[str] = None


class NeuralStyleCreate(BaseModel):
    photographer_id: str
    name: str
    description: Optional[str] = None
    reference_image_keys: list[str] = []
    pairs: list[dict] = []  # [{"original_key": "...", "edited_key": "..."}]


class StyleProfileResponse(BaseModel):
    id: str
    name: str
    status: str
    message: str


# ── Existing CPU histogram training ──────────────────────

@router.post("/create", response_model=StyleProfileResponse)
async def create_style_profile(profile: StyleProfileCreate):
    if len(profile.reference_image_keys) < 10:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message=f"Need at least 10 reference images, got {len(profile.reference_image_keys)}",
        )

    initial_settings = profile.settings or {}
    if profile.preset_file_key:
        initial_settings["preset_file_key"] = profile.preset_file_key
        log.info(f"Preset file included: {profile.preset_file_key}")

    sb = get_supabase()
    row = sb.insert("style_profiles", {
        "photographer_id": profile.photographer_id,
        "name": profile.name,
        "description": profile.description,
        "reference_image_keys": profile.reference_image_keys,
        "settings": initial_settings,
        "status": "pending",
        "training_method": "histogram",
    })

    if not row:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message="Failed to create style profile",
        )

    profile_id = row["id"]

    def train_in_thread():
        try:
            train_profile(profile_id)
        except Exception as e:
            log.error(f"Style training thread error: {e}")

    thread = Thread(target=train_in_thread, daemon=True)
    thread.start()

    return StyleProfileResponse(
        id=profile_id, name=profile.name, status="training",
        message=f"Training started with {len(profile.reference_image_keys)} reference images"
                f"{' + Lightroom preset' if profile.preset_file_key else ''}.",
    )


# ── NEW: GPU neural LUT training via Modal ───────────────

@router.post("/create-neural", response_model=StyleProfileResponse)
async def create_neural_style(profile: NeuralStyleCreate):
    if len(profile.pairs) < 5:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message=f"Need at least 5 before/after pairs, got {len(profile.pairs)}",
        )

    if not MODAL_BASE_URL:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message="GPU training not configured. Set MODAL_BASE_URL.",
        )

    sb = get_supabase()
    row = sb.insert("style_profiles", {
        "photographer_id": profile.photographer_id,
        "name": profile.name,
        "description": profile.description,
        "reference_image_keys": profile.reference_image_keys,
        "settings": {},
        "status": "pending",
        "training_method": "neural_lut",
        "pairs_used": len(profile.pairs),
    })

    if not row:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message="Failed to create style profile",
        )

    profile_id = row["id"]

    def train_neural_in_thread():
        try:
            _run_neural_training(profile_id, profile.pairs)
        except Exception as e:
            log.error(f"Neural training thread error: {e}")
            update_style_profile(profile_id, status="error", training_error=str(e))

    thread = Thread(target=train_neural_in_thread, daemon=True)
    thread.start()

    return StyleProfileResponse(
        id=profile_id, name=profile.name, status="training",
        message=f"GPU neural training started with {len(profile.pairs)} before/after pairs.",
    )


def _run_neural_training(profile_id: str, pairs: list[dict]):
    """Call Modal GPU to train a neural 3D LUT model from before/after pairs."""
    from datetime import datetime, timezone

    update_style_profile(
        profile_id,
        status="training",
        training_started_at=datetime.now(timezone.utc).isoformat(),
    )

    try:
        s = get_settings()
        train_url = _modal_endpoint("train_style")

        log.info(f"Neural training: calling Modal at {train_url} with {len(pairs)} pairs")

        resp = httpx.post(train_url, json={
            "pairs": pairs,
            "supabase_url": s.supabase_url,
            "supabase_key": s.supabase_service_role_key,
            "bucket": s.storage_bucket,
            "epochs": 200,
            "lut_size": 33,
            "lr": 1e-4,
            "profile_id": profile_id,
        }, timeout=1200)  # 20 min timeout for training

        result = resp.json()

        if result.get("status") == "error":
            raise Exception(result.get("message", "Modal training returned error"))

        # Update profile with model info
        update_style_profile(
            profile_id,
            status="ready",
            model_key=result.get("model_key", ""),
            model_filename=result.get("model_key", "").split("/")[-1] if result.get("model_key") else "",
            training_time_s=result.get("training_time_s", 0),
            pairs_used=result.get("pairs_used", len(pairs)),
            training_completed_at=datetime.now(timezone.utc).isoformat(),
        )

        log.info(f"Neural training complete for {profile_id}: "
                 f"{result.get('training_time_s', 0):.1f}s, "
                 f"loss={result.get('final_loss', 'N/A')}")

    except Exception as e:
        log.error(f"Neural training failed for {profile_id}: {e}")
        update_style_profile(
            profile_id,
            status="error",
            training_error=str(e)[:500],
        )


# ── Status & retrain endpoints (unchanged) ───────────────

@router.get("/{profile_id}/status")
async def get_training_status(profile_id: str):
    profile = get_style_profile(profile_id)
    if not profile:
        return {"error": "Profile not found"}
    return {
        "id": profile["id"],
        "name": profile["name"],
        "status": profile["status"],
        "training_method": profile.get("training_method", "histogram"),
        "reference_count": len(profile.get("reference_image_keys", [])),
        "has_preset": bool(profile.get("settings", {}).get("preset_file_key")),
        "pairs_used": profile.get("pairs_used"),
        "training_time_s": profile.get("training_time_s"),
        "training_error": profile.get("training_error"),
        "training_started_at": profile.get("training_started_at"),
        "training_completed_at": profile.get("training_completed_at"),
    }


@router.post("/{profile_id}/retrain")
async def retrain_profile(profile_id: str):
    profile = get_style_profile(profile_id)
    if not profile:
        return {"error": "Profile not found"}

    training_method = profile.get("training_method", "histogram")

    if training_method == "neural_lut":
        # Neural retrain not yet supported — would need pairs stored
        return {"error": "Neural models must be retrained by creating a new style profile."}

    if not profile.get("reference_image_keys"):
        return {"error": "No reference images to train from"}

    def train_in_thread():
        try:
            train_profile(profile_id)
        except Exception as e:
            log.error(f"Re-training thread error: {e}")

    thread = Thread(target=train_in_thread, daemon=True)
    thread.start()

    return {"id": profile_id, "status": "training", "message": "Re-training started"}
