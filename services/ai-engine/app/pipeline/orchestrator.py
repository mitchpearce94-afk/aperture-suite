"""
Apelier AI Processing Pipeline — Orchestrator (GPU-enabled)

Runs all 6 phases for a gallery:
  Phase 0: Analysis        (CPU — Railway)
  Phase 1: Style           (GPU — Modal)  ← falls back to CPU
  Phase 2: Face Retouch    (GPU — Modal)  ← falls back to stub
  Phase 3: Scene Cleanup   (GPU — Modal)  ← falls back to stub
  Phase 4: Composition     (CPU — Railway)
  Phase 5: QA & Output     (CPU — Railway)

Updates processing_jobs in real-time so the frontend can show progress.
"""

import asyncio
import time
import logging
import traceback
from typing import Optional

from app.config import settings, supabase
from app.pipeline.phase0_analysis import run_phase0
# CPU style fallback removed — quality was unacceptable
# Phase 1 requires GPU (Modal) + trained neural model
from app.pipeline.phase4_composition import run_phase4
from app.pipeline.phase5_output import run_phase5
from app.modal.client import ModalClient

logger = logging.getLogger("apelier.orchestrator")

# Phase IDs must match frontend phase definitions
PHASES = ["analysis", "style", "retouch", "cleanup", "composition", "output"]


async def run_pipeline(
    gallery_id: str,
    job_id: str,
    photographer_id: str,
    processing_job_id: str,
    style_profile_id: Optional[str] = None,
):
    """
    Run the full 6-phase AI pipeline for a gallery.

    Args:
        gallery_id: UUID of the gallery
        job_id: UUID of the job
        photographer_id: UUID of the photographer
        processing_job_id: UUID of the processing_jobs record
        style_profile_id: Optional UUID of style profile to apply
    """
    t_start = time.time()
    modal_client = ModalClient()
    use_gpu = modal_client.is_configured

    # Check Modal health
    if use_gpu:
        health = await modal_client.health()
        if health.get("status") != "ok":
            logger.warning(f"Modal unavailable ({health}), falling back to CPU")
            use_gpu = False
        else:
            logger.info("Modal GPU endpoints available")

    # Get style profile info if set
    model_filename = None
    if style_profile_id and use_gpu:
        try:
            profile = supabase.select_single("style_profiles", {"id": style_profile_id})
            if profile and profile.get("model_key"):
                # model_filename is stored as "{photographer_id}_{style_id}.pth"
                model_filename = profile["model_key"].split("/")[-1]
                logger.info(f"Using neural style model: {model_filename}")
            else:
                logger.info("Style profile has no trained model, using CPU fallback")
        except Exception as e:
            logger.warning(f"Could not load style profile: {e}")

    # Load photos for this gallery
    photos = supabase.select("photos", {"gallery_id": gallery_id, "is_culled": False})
    if not photos:
        logger.error(f"No photos found for gallery {gallery_id}")
        await _update_job_status(processing_job_id, "failed", error="No photos found")
        return

    total_photos = len(photos)
    logger.info(f"Starting pipeline: {total_photos} photos, GPU={'enabled' if use_gpu else 'disabled'}")

    try:
        # ═══════════════════════════════════════════════════════
        # PHASE 0 — ANALYSIS (CPU)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "analysis", 0)
        for i, photo in enumerate(photos):
            try:
                analysis = await run_phase0(photo, supabase)
                # Update photo record with analysis results
                supabase.update("photos", photo["id"], {
                    "scene_type": analysis.get("scene_type"),
                    "quality_score": analysis.get("quality_score"),
                    "face_data": analysis.get("face_data"),
                    "exif_data": analysis.get("exif_data"),
                    "duplicate_hash": analysis.get("duplicate_hash"),
                })
            except Exception as e:
                logger.error(f"Phase 0 failed for photo {photo['id']}: {e}")
            await _update_phase(processing_job_id, "analysis", i + 1)

        # ═══════════════════════════════════════════════════════
        # PHASE 1 — STYLE APPLICATION (GPU only — no CPU fallback)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "style", 0)

        if not use_gpu:
            logger.error("Phase 1: Modal GPU unavailable. Cannot process.")
            await _update_job_status(processing_job_id, "failed", error="GPU service unavailable. Please try again later.")
            return

        if not model_filename:
            logger.error("Phase 1: No trained style model found. Train a style first.")
            await _update_job_status(processing_job_id, "failed", error="No trained style profile. Go to Settings → Editing Style to train one.")
            return

        logger.info(f"Phase 1 (GPU): Applying neural style to {total_photos} images")
        batch_items = []
        for photo in photos:
            if photo.get("original_key"):
                edited_key = photo["original_key"].replace("uploads/", "edited/")
                batch_items.append({
                    "image_key": photo["original_key"],
                    "output_key": edited_key,
                })

        # Process in batches of 20 to avoid timeout
        BATCH_SIZE = 20
        processed = 0
        for batch_start in range(0, len(batch_items), BATCH_SIZE):
            batch = batch_items[batch_start:batch_start + BATCH_SIZE]
            result = await modal_client.apply_style_batch(
                images=batch,
                model_filename=model_filename,
                jpeg_quality=95,
            )
            if result.get("status") == "error":
                logger.error(f"GPU style batch failed: {result.get('message')}")
                await _update_job_status(processing_job_id, "failed", error=f"GPU style failed: {result.get('message')}")
                return

            processed += len(batch)
            await _update_phase(processing_job_id, "style", processed)

            # Update photo records with edited keys
            for item, photo in zip(batch, photos[batch_start:batch_start + BATCH_SIZE]):
                supabase.update("photos", photo["id"], {
                    "edited_key": item["output_key"],
                    "ai_edits": {**(photo.get("ai_edits") or {}), "style": "neural_lut"},
                })

        # ═══════════════════════════════════════════════════════
        # PHASE 2 — FACE RETOUCHING (GPU only — skip if unavailable)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "retouch", 0)

        if use_gpu:
            logger.info(f"Phase 2 (GPU): Face retouching {total_photos} images")
            for i, photo in enumerate(photos):
                try:
                    face_data = photo.get("face_data")
                    if face_data and len(face_data) > 0:
                        edited_key = photo.get("edited_key") or photo["original_key"].replace("uploads/", "edited/")
                        result = await modal_client.face_retouch(
                            image_key=edited_key,
                            output_key=edited_key,
                            fidelity=0.7,
                            face_data=face_data,
                        )
                        if result.get("status") == "success":
                            supabase.update("photos", photo["id"], {
                                "ai_edits": {
                                    **(photo.get("ai_edits") or {}),
                                    "face_retouch": {
                                        "faces": result.get("faces_found", 0),
                                        "fidelity": 0.7,
                                    },
                                },
                            })
                except Exception as e:
                    logger.error(f"Phase 2 failed for {photo['id']}: {e}")
                await _update_phase(processing_job_id, "retouch", i + 1)
        else:
            logger.warning("Phase 2: Skipped (GPU unavailable)")
            await _update_phase(processing_job_id, "retouch", total_photos)

        # ═══════════════════════════════════════════════════════
        # PHASE 3 — SCENE CLEANUP (GPU only — skip if unavailable)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "cleanup", 0)

        if use_gpu:
            logger.info(f"Phase 3 (GPU): Scene cleanup on {total_photos} images")
            for i, photo in enumerate(photos):
                try:
                    edited_key = photo.get("edited_key") or photo["original_key"].replace("uploads/", "edited/")
                    result = await modal_client.scene_cleanup(
                        image_key=edited_key,
                        output_key=edited_key,
                        detections=["power_lines", "exit_signs"],
                    )
                    if result.get("status") == "success" and result.get("detections_found", 0) > 0:
                        supabase.update("photos", photo["id"], {
                            "ai_edits": {
                                **(photo.get("ai_edits") or {}),
                                "scene_cleanup": {
                                    "detections": result.get("detections_found", 0),
                                    "coverage_pct": result.get("mask_coverage_pct", 0),
                                },
                            },
                        })
                except Exception as e:
                    logger.error(f"Phase 3 failed for {photo['id']}: {e}")
                await _update_phase(processing_job_id, "cleanup", i + 1)
        else:
            logger.warning("Phase 3: Skipped (GPU unavailable)")
            await _update_phase(processing_job_id, "cleanup", total_photos)

        # ═══════════════════════════════════════════════════════
        # PHASE 4 — COMPOSITION (CPU)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "composition", 0)
        for i, photo in enumerate(photos):
            try:
                await run_phase4(photo, supabase)
            except Exception as e:
                logger.error(f"Phase 4 failed for {photo['id']}: {e}")
            await _update_phase(processing_job_id, "composition", i + 1)

        # ═══════════════════════════════════════════════════════
        # PHASE 5 — QA & OUTPUT (CPU)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "output", 0)
        for i, photo in enumerate(photos):
            try:
                await run_phase5(photo, gallery_id, supabase)
            except Exception as e:
                logger.error(f"Phase 5 failed for {photo['id']}: {e}")
            await _update_phase(processing_job_id, "output", i + 1)

        # ═══════════════════════════════════════════════════════
        # DONE — update statuses
        # ═══════════════════════════════════════════════════════
        elapsed = time.time() - t_start

        # Mark gallery as ready
        supabase.update("galleries", gallery_id, {"status": "ready"})
        # Mark job as ready_for_review
        supabase.update("jobs", job_id, {"status": "ready_for_review"})
        # Mark processing job as completed
        await _update_job_status(processing_job_id, "completed")

        logger.info(
            f"Pipeline complete: {total_photos} photos in {elapsed:.1f}s "
            f"({elapsed/total_photos:.1f}s/photo avg), GPU={'yes' if use_gpu else 'no'}"
        )

    except Exception as e:
        logger.error(f"Pipeline failed: {e}\n{traceback.format_exc()}")
        await _update_job_status(processing_job_id, "failed", error=str(e))

    finally:
        await modal_client.close()


# ─── Helper functions ─────────────────────────────────────────────────

async def _update_phase(processing_job_id: str, phase: str, processed_images: int):
    """Update the current phase and progress in the processing_jobs table."""
    try:
        supabase.update("processing_jobs", processing_job_id, {
            "current_phase": phase,
            "processed_images": processed_images,
        })
    except Exception as e:
        logger.warning(f"Failed to update phase progress: {e}")


async def _update_job_status(processing_job_id: str, status: str, error: str = None):
    """Update the processing job status."""
    try:
        data = {"status": status}
        if error:
            data["error"] = error
        supabase.update("processing_jobs", processing_job_id, data)
    except Exception as e:
        logger.warning(f"Failed to update job status: {e}")
