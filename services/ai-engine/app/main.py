from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import process, style, health
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

app = FastAPI(
    title="Apelier AI Engine",
    description="AI photo processing pipeline for Apelier — analysis, style application, composition, and output generation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Railway handles auth via service-to-service — frontend bridge routes are the gatekeepers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(process.router, prefix="/api/process", tags=["processing"])
app.include_router(style.router, prefix="/api/style", tags=["style"])

# Restyle endpoint (re-process single photo with different style)
@app.post("/api/process/restyle")
async def restyle_photo(body: dict):
    """Re-edit a single photo with a different style profile."""
    from app.modal.client import ModalClient
    from app.config import get_supabase

    photo_id = body.get("photo_id")
    style_profile_id = body.get("style_profile_id")
    if not photo_id or not style_profile_id:
        return {"status": "error", "message": "Missing photo_id or style_profile_id"}

    sb = get_supabase()

    # Get style profile
    profile = sb.select_single("style_profiles", filters={"id": style_profile_id})
    if not profile:
        return {"status": "error", "message": "Style profile not found"}

    model_key = profile.get("model_key") or profile.get("model_weights_key")
    if not model_key:
        return {"status": "error", "message": "Style profile has no trained model"}

    model_filename = model_key.split("/")[-1]

    # Get photo
    photo = sb.select_single("photos", filters={"id": photo_id})
    if not photo:
        return {"status": "error", "message": "Photo not found"}

    original_key = photo["original_key"]
    edited_key = original_key.replace("/originals/", "/edited/")
    if not edited_key.lower().endswith((".jpg", ".jpeg")):
        edited_key = edited_key.rsplit(".", 1)[0] + ".jpg"

    modal_client = ModalClient()
    try:
        result = await modal_client.apply_style(
            image_key=original_key,
            model_filename=model_filename,
            output_key=edited_key,
            jpeg_quality=95,
        )

        if result.get("status") == "success":
            sb.update("photos", {"edited_key": edited_key, "ai_edits": {
                **(photo.get("ai_edits") or {}),
                "style_applied": "neural_lut",
                "has_preset": True,
                "restyled": True,
            }}, {"id": f"eq.{photo_id}"})
            return {"status": "success", "output_key": edited_key}
        else:
            return {"status": "error", "message": result.get("message", "Style application failed")}
    finally:
        await modal_client.close()


@app.on_event("startup")
async def startup():
    print("Apelier AI Engine starting...")


@app.on_event("shutdown")
async def shutdown():
    print("Apelier AI Engine shutting down...")
