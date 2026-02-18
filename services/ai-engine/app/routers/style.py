"""
Updated style training router — supports both:
1. Reference-only training (existing CPU histogram method)
2. Before/after pair training (new GPU neural LUT method via Modal)

Replaces: app/routers/style.py
"""

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import logging

from app.config import settings, supabase
from app.modal.client import ModalClient

router = APIRouter()
logger = logging.getLogger("apelier.style")


class TrainStyleRequest(BaseModel):
    photographer_id: str
    style_profile_id: str
    # For reference-only training (existing method)
    reference_keys: Optional[list[str]] = None
    # For before/after pair training (new GPU method)
    pairs: Optional[list[dict]] = None
    # Training params
    epochs: int = 200


class TrainStatusResponse(BaseModel):
    status: str
    message: Optional[str] = None
    model_key: Optional[str] = None
    model_filename: Optional[str] = None
    training_time_s: Optional[float] = None


@router.post("/api/style/train")
async def train_style(req: TrainStyleRequest, background_tasks: BackgroundTasks):
    """
    Start style model training.

    Two modes:
    1. pairs provided → GPU neural LUT training via Modal (preferred)
    2. reference_keys provided → CPU histogram training (legacy fallback)
    """
    if req.pairs and len(req.pairs) >= 5:
        # GPU training via Modal
        logger.info(f"Starting GPU style training: {len(req.pairs)} pairs")
        # Update style profile status
        supabase.update("style_profiles", req.style_profile_id, {
            "training_status": "training",
            "training_method": "neural_lut",
        })
        background_tasks.add_task(
            _train_neural_style,
            req.photographer_id,
            req.style_profile_id,
            req.pairs,
            req.epochs,
        )
        return {"status": "training", "message": f"Neural LUT training started with {len(req.pairs)} pairs"}

    elif req.reference_keys and len(req.reference_keys) >= 5:
        # CPU training (legacy — histogram method)
        logger.info(f"Starting CPU style training: {len(req.reference_keys)} references")
        supabase.update("style_profiles", req.style_profile_id, {
            "training_status": "training",
            "training_method": "histogram",
        })
        background_tasks.add_task(
            _train_histogram_style,
            req.photographer_id,
            req.style_profile_id,
            req.reference_keys,
        )
        return {"status": "training", "message": f"Histogram training started with {len(req.reference_keys)} references"}

    else:
        return {"status": "error", "message": "Need at least 5 before/after pairs or 5 reference images"}


@router.get("/api/style/status/{style_profile_id}")
async def get_training_status(style_profile_id: str):
    """Check training status for a style profile."""
    profile = supabase.select_single("style_profiles", {"id": style_profile_id})
    if not profile:
        return {"status": "error", "message": "Style profile not found"}
    return {
        "status": profile.get("training_status", "unknown"),
        "training_method": profile.get("training_method"),
        "model_key": profile.get("model_key"),
    }


async def _train_neural_style(
    photographer_id: str,
    style_profile_id: str,
    pairs: list[dict],
    epochs: int,
):
    """Background task: train neural LUT model via Modal GPU."""
    modal_client = ModalClient()
    try:
        result = await modal_client.train_style(
            photographer_id=photographer_id,
            style_profile_id=style_profile_id,
            pairs=pairs,
            epochs=epochs,
        )
        if result.get("status") == "success":
            supabase.update("style_profiles", style_profile_id, {
                "training_status": "completed",
                "model_key": result["model_key"],
                "model_filename": result.get("model_filename"),
                "training_time_s": result.get("training_time_s"),
                "pairs_used": result.get("pairs_used"),
            })
            logger.info(f"Neural style training complete: {result['model_key']}")
        else:
            supabase.update("style_profiles", style_profile_id, {
                "training_status": "failed",
                "training_error": result.get("message", "Unknown error"),
            })
            logger.error(f"Neural style training failed: {result.get('message')}")
    except Exception as e:
        supabase.update("style_profiles", style_profile_id, {
            "training_status": "failed",
            "training_error": str(e),
        })
        logger.error(f"Neural style training error: {e}")
    finally:
        await modal_client.close()


async def _train_histogram_style(
    photographer_id: str,
    style_profile_id: str,
    reference_keys: list[str],
):
    """Background task: train histogram-based style (existing CPU method)."""
    from app.workers.style_trainer import train_style_profile
    try:
        await train_style_profile(photographer_id, style_profile_id, reference_keys)
        supabase.update("style_profiles", style_profile_id, {
            "training_status": "completed",
        })
    except Exception as e:
        supabase.update("style_profiles", style_profile_id, {
            "training_status": "failed",
            "training_error": str(e),
        })
        logger.error(f"Histogram style training error: {e}")
