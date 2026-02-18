"""
Style Profile API routes — create, train, and manage style profiles.
v2.0: Supports preset file uploads + photographer isolation.
"""
import logging
from threading import Thread
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.workers.style_trainer import train_profile
from app.storage.db import get_style_profile, validate_style_profile_ownership
from app.config import get_supabase

router = APIRouter()
log = logging.getLogger(__name__)


class StyleProfileCreate(BaseModel):
    photographer_id: str
    name: str
    description: Optional[str] = None
    reference_image_keys: list[str] = []
    settings: Optional[dict] = None
    preset_file_key: Optional[str] = None  # v2.0: Lightroom preset storage key


class StyleProfileResponse(BaseModel):
    id: str
    name: str
    status: str
    message: str


@router.post("/create", response_model=StyleProfileResponse)
async def create_style_profile(profile: StyleProfileCreate):
    if len(profile.reference_image_keys) < 10:
        return StyleProfileResponse(
            id="", name=profile.name, status="error",
            message=f"Need at least 10 reference images, got {len(profile.reference_image_keys)}",
        )

    # Build initial settings — include preset_file_key if provided
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


@router.get("/{profile_id}/status")
async def get_training_status(profile_id: str):
    profile = get_style_profile(profile_id)
    if not profile:
        return {"error": "Profile not found"}
    return {
        "id": profile["id"],
        "name": profile["name"],
        "status": profile["status"],
        "reference_count": len(profile.get("reference_image_keys", [])),
        "has_preset": bool(profile.get("settings", {}).get("preset_file_key")),
        "version": profile.get("settings", {}).get("version", "1.0"),
        "training_started_at": profile.get("training_started_at"),
        "training_completed_at": profile.get("training_completed_at"),
    }


@router.post("/{profile_id}/retrain")
async def retrain_profile(profile_id: str):
    profile = get_style_profile(profile_id)
    if not profile:
        return {"error": "Profile not found"}
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
