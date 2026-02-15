"""
Processing API routes — trigger and monitor gallery processing.
"""
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

    total = len(photos)

    sb = get_supabase()
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
            run_pipeline(
                processing_job_id=job_id,
                gallery_id=request.gallery_id,
                style_profile_id=request.style_profile_id,
                settings_override=request.settings,
                included_images=request.included_images,
            )
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


@router.get("/status/{job_id}")
async def get_processing_status(job_id: str):
    try:
        sb = get_supabase()
        job = sb.select_single("processing_jobs", "*", {"id": f"eq.{job_id}"})
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
