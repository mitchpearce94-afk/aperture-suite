from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ProcessRequest(BaseModel):
    gallery_id: str
    style_profile_id: str
    settings: Optional[dict] = None


class ProcessResponse(BaseModel):
    job_id: str
    status: str
    message: str


@router.post("/gallery", response_model=ProcessResponse)
async def process_gallery(request: ProcessRequest):
    """Trigger AI processing for an entire gallery."""
    # TODO: Queue processing job via BullMQ/Redis
    return ProcessResponse(
        job_id="placeholder",
        status="queued",
        message=f"Processing queued for gallery {request.gallery_id}",
    )


@router.post("/single/{photo_id}")
async def process_single_photo(photo_id: str, prompt: Optional[str] = None):
    """Process or re-process a single photo, optionally with a prompt edit."""
    # TODO: Implement single photo processing
    return {
        "photo_id": photo_id,
        "status": "queued",
        "prompt": prompt,
    }


@router.get("/status/{job_id}")
async def get_processing_status(job_id: str):
    """Get the status of a processing job."""
    # TODO: Check BullMQ job status
    return {
        "job_id": job_id,
        "status": "processing",
        "progress": 0,
        "total": 0,
    }
