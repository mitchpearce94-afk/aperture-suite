from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class StyleProfileCreate(BaseModel):
    photographer_id: str
    name: str
    description: Optional[str] = None
    settings: Optional[dict] = None


class StyleProfileResponse(BaseModel):
    id: str
    name: str
    status: str
    message: str


@router.post("/create", response_model=StyleProfileResponse)
async def create_style_profile(profile: StyleProfileCreate):
    """Create a new style profile and begin training."""
    # TODO: Create profile in DB, trigger training
    return StyleProfileResponse(
        id="placeholder",
        name=profile.name,
        status="pending_images",
        message="Profile created. Upload 50-200 reference images to begin training.",
    )


@router.post("/{profile_id}/upload-references")
async def upload_reference_images(
    profile_id: str,
    files: List[UploadFile] = File(...),
):
    """Upload reference images for style training."""
    # TODO: Store images in B2, trigger training when enough images
    return {
        "profile_id": profile_id,
        "images_uploaded": len(files),
        "status": "uploading",
        "message": f"Received {len(files)} reference images.",
    }


@router.get("/{profile_id}/status")
async def get_training_status(profile_id: str):
    """Get the training status of a style profile."""
    # TODO: Check training job status
    return {
        "profile_id": profile_id,
        "status": "training",
        "progress": 0,
    }
