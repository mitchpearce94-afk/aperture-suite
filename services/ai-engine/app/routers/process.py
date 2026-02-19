"""
Processing API routes — trigger and monitor gallery processing.
"""
import asyncio
import logging
from threading import Thread
from fastapi import APIRouter
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
async def process_gallery(request: ProcessRequest):
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

    # Extract photographer_id and job_id from gallery
    photographer_id = gallery.get("photographer_id")
    job_data = gallery.get("job") or {}
    job_id = job_data.get("id") if isinstance(job_data, dict) else gallery.get("job_id")

    # Check for existing processing job for this gallery — reuse it
    existing_jobs = sb.select(
        "processing_jobs",
        {"gallery_id": request.gallery_id},
        order="created_at.desc",
    )

    job_row = None
    if existing_jobs:
        existing = existing_jobs[0]
        sb.update("processing_jobs", existing["id"], {
            "total_images": total,
            "processed_images": total - len(unprocessed),
            "status": "queued",
            "current_phase": "queued",
            "completed_at": None,
            "error_log": None,
        })
        job_row = existing
        log.info(f"Reusing existing processing job {existing['id']} for gallery {request.gallery_id}")
    else:
        job_row = sb.insert("processing_jobs", {
            "gallery_id": request.gallery_id,
            "photographer_id": photographer_id,
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

    processing_job_id = job_row["id"]

    # Run pipeline in a background thread with proper asyncio.run()
    def run_in_thread():
        try:
            asyncio.run(run_pipeline(
                gallery_id=request.gallery_id,
                processing_job_id=processing_job_id,
                photographer_id=photographer_id,
                job_id=job_id,
                style_profile_id=request.style_profile_id,
            ))
        except Exception as e:
            log.error(f"Pipeline thread error: {e}")
            # Mark job as failed
            try:
                sb = get_supabase()
                sb.update("processing_jobs", processing_job_id, {
                    "status": "failed",
                    "error_log": str(e),
                })
            except Exception:
                pass

    thread = Thread(target=run_in_thread, daemon=True)
    thread.start()

    return ProcessResponse(
        job_id=processing_job_id, status="queued",
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
        job = sb.select_single("processing_jobs", {"id": job_id})
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
