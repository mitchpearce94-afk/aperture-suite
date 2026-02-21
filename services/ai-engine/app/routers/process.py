"""
Processing API routes — trigger and monitor gallery processing.
"""
import asyncio
import logging
from threading import Thread
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from app.pipeline.orchestrator import run_pipeline
from app.storage.db import get_gallery_photos, get_gallery
from app.config import get_supabase

router = APIRouter()
log = logging.getLogger(__name__)


class ProcessRequest(BaseModel):
    gallery_id: str
    style_profile_id: Optional[str] = None
    settings: Optional[dict] = None
    included_images: Optional[int] = None


class ProcessResponse(BaseModel):
    job_id: str
    status: str
    message: str
    total_images: int


@router.post("/gallery", response_model=ProcessResponse)
async def process_gallery(request: ProcessRequest, background_tasks: BackgroundTasks):
    gallery = get_gallery(request.gallery_id)
    if not gallery:
        return ProcessResponse(
            job_id="", status="error",
            message=f"Gallery {request.gallery_id} not found", total_images=0,
        )

    photos = get_gallery_photos(request.gallery_id)
    if not photos:
        return ProcessResponse(
            job_id="", status="error",
            message="No photos found in gallery. Upload photos first.", total_images=0,
        )

    # Count only unprocessed photos (no edited_key yet)
    unprocessed = [p for p in photos if not p.get("edited_key")]
    total = len(photos)

    if not unprocessed:
        return ProcessResponse(
            job_id="", status="completed",
            message="All photos already processed", total_images=total,
        )

    sb = get_supabase()

    # Check for existing processing job for this gallery — reuse it instead of creating a new one
    existing_jobs = sb.select(
        "processing_jobs",
        filters={"gallery_id": request.gallery_id},
        order="created_at.desc",
    )

    job_row = None
    if existing_jobs:
        # Reuse the most recent job — reset it for re-processing
        existing = existing_jobs[0]
        sb.update("processing_jobs", {
            "total_images": total,
            "processed_images": total - len(unprocessed),
            "status": "queued",
            "current_phase": "queued",
            "completed_at": None,
            "error_log": None,
        }, {"id": f"eq.{existing['id']}"})
        job_row = existing
        log.info(f"Reusing existing processing job {existing['id']} for gallery {request.gallery_id}")
    else:
        # Create new processing job
        job_row = sb.insert("processing_jobs", {
            "gallery_id": request.gallery_id,
            "photographer_id": gallery["photographer_id"],
            "style_profile_id": request.style_profile_id,
            "total_images": total,
            "processed_images": 0,
            "status": "queued",
            "current_phase": "queued",
        })

    if not job_row:
        return ProcessResponse(
            job_id="", status="error",
            message="Failed to create processing job", total_images=0,
        )

    job_id = job_row["id"]

    def run_in_thread():
        try:
            asyncio.run(run_pipeline(
                processing_job_id=job_id,
                gallery_id=request.gallery_id,
                style_profile_id=request.style_profile_id,
                settings_override=request.settings,
                included_images=request.included_images,
            ))
        except Exception as e:
            log.error(f"Pipeline thread error: {e}")

    thread = Thread(target=run_in_thread, daemon=True)
    thread.start()

    return ProcessResponse(
        job_id=job_id, status="queued",
        message=f"Processing queued for {total} photos", total_images=total,
    )


@router.post("/single/{photo_id}")
async def process_single_photo(photo_id: str, prompt: Optional[str] = None):
    return {
        "photo_id": photo_id,
        "status": "not_available",
        "prompt": prompt,
        "message": "Single photo re-processing requires GPU models. Architecture ready.",
    }


class RestyleRequest(BaseModel):
    photo_id: str
    style_profile_id: str
    gallery_id: Optional[str] = None


@router.post("/restyle")
async def restyle_photo(request: RestyleRequest):
    """Re-apply a different style profile to a single photo."""
    from app.pipeline.phase1_style import apply_style, load_image_from_bytes, compute_channel_stats
    from app.storage.supabase_storage import download_photo, upload_photo
    import cv2
    import numpy as np

    try:
        sb = get_supabase()

        # Get the photo record
        photo = sb.select_single("photos", filters={"id": request.photo_id})
        if not photo:
            return {"error": "Photo not found", "status": "error"}

        original_key = photo.get("original_key")
        if not original_key:
            return {"error": "Photo has no original file", "status": "error"}

        # Get the style profile
        profile = sb.select_single("style_profiles", filters={"id": request.style_profile_id})
        if not profile:
            return {"error": "Style profile not found", "status": "error"}

        if profile.get("status") != "ready":
            return {"error": "Style profile is not trained yet", "status": "error"}

        settings = profile.get("settings") or {}

        # Download the original photo
        img_bytes = download_photo(original_key)
        if not img_bytes:
            return {"error": "Could not download original photo", "status": "error"}

        img = load_image_from_bytes(img_bytes)
        if img is None:
            return {"error": "Could not decode photo", "status": "error"}

        # Apply the style
        ref = settings.get("reference")
        preset = settings.get("preset")
        if ref:
            from app.pipeline.phase1_style import _apply_reference_style
            result_img = _apply_reference_style(img, ref, intensity=0.75)
            if preset:
                from app.pipeline.phase1_style import apply_preset_params
                result_img = apply_preset_params(result_img, preset, intensity=0.5)
        elif preset:
            from app.pipeline.phase1_style import apply_preset_params
            result_img = apply_preset_params(img, preset, intensity=0.85)
        else:
            result_img = apply_style(img, settings)

        # Encode result as JPEG
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 95]
        _, buffer = cv2.imencode('.jpg', result_img, encode_params)
        result_bytes = buffer.tobytes()

        # Upload to edited location
        edited_key = original_key.replace("/originals/", "/edited/").rsplit(".", 1)[0] + ".jpg"
        upload_photo(edited_key, result_bytes, "image/jpeg")

        # Update photo record
        sb.update("photos", request.photo_id, {
            "edited_key": edited_key,
            "ai_edits": {
                **(photo.get("ai_edits") or {}),
                "style_applied": True,
                "style_profile_id": request.style_profile_id,
                "style_profile_name": profile.get("name", "Unknown"),
            },
        })

        # Generate a fresh signed URL for the edited image
        from app.storage.supabase_storage import get_signed_url
        edited_url = get_signed_url(edited_key) or ""

        return {
            "photo_id": request.photo_id,
            "status": "success",
            "edited_key": edited_key,
            "edited_url": edited_url,
            "style_name": profile.get("name"),
            "message": f"Style '{profile.get('name')}' applied successfully",
        }

    except Exception as e:
        log.error(f"Restyle failed: {e}")
        return {"error": str(e), "status": "error"}


@router.get("/status/{job_id}")
async def get_processing_status(job_id: str):
    try:
        sb = get_supabase()
        job = sb.select_single("processing_jobs", filters={"id": job_id})
        if not job:
            return {"error": "Job not found"}

        return {
            "job_id": job["id"],
            "status": job["status"],
            "current_phase": job.get("current_phase"),
            "processed_images": job.get("processed_images", 0),
            "total_images": job.get("total_images", 0),
            "progress": round(
                (job.get("processed_images", 0) / max(1, job.get("total_images", 1))) * 100, 1
            ),
            "error_log": job.get("error_log"),
            "started_at": job.get("started_at"),
            "completed_at": job.get("completed_at"),
        }
    except Exception as e:
        log.error(f"Failed to get job status: {e}")
        return {"error": str(e)}
