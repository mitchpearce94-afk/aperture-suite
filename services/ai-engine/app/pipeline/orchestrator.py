"""
Apelier AI Processing Pipeline — Orchestrator (GPU-enabled)

Runs all 6 phases for a gallery:
  Phase 0: Analysis        (CPU — Railway)
  Phase 1: Style           (GPU — Modal)  <- falls back gracefully
  Phase 2: Face Retouch    (GPU — Modal)  <- skips if unavailable
  Phase 3: Scene Cleanup   (GPU — Modal)  <- skips if unavailable
  Phase 4: Composition     (CPU — Railway)
  Phase 5: QA & Output     (CPU — Railway)

Updates processing_jobs in real-time so the frontend can show progress.
"""

import asyncio
import time
import logging
import traceback
import numpy as np
import cv2
from typing import Optional

from app.config import settings, supabase
from app.pipeline.phase0_analysis import analyse_image, decode_raw, is_raw_file
from app.pipeline.phase4_composition import fix_composition
from app.pipeline.phase5_output import generate_outputs, get_output_keys
from app.modal.client import ModalClient

logger = logging.getLogger("apelier.orchestrator")

PHASES = ["analysis", "style", "retouch", "cleanup", "composition", "output"]

PIPELINE_VERSION = "2.0"


def _decode_image_bytes(img_bytes: bytes, filename: str = "") -> Optional[np.ndarray]:
    """Decode image bytes to BGR numpy array, handling both standard and RAW formats."""
    import cv2
    import numpy as np

    # Try standard decode first (JPEG, PNG, TIFF)
    img = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is not None:
        return img

    # If standard decode fails, try RAW decode
    img = decode_raw(img_bytes)
    if img is not None:
        return img

    logger.warning(f"Could not decode image: {filename}")
    return None


async def run_pipeline(
    gallery_id: str,
    processing_job_id: str,
    photographer_id: Optional[str] = None,
    job_id: Optional[str] = None,
    style_profile_id: Optional[str] = None,
    settings_override: Optional[dict] = None,
    included_images: Optional[list[str]] = None,
):
    """
    Run the full 6-phase AI pipeline for a gallery.
    """
    t_start = time.time()
    modal_client = ModalClient()
    use_gpu = modal_client.is_configured

    # Look up gallery if we need photographer_id / job_id
    if not photographer_id or not job_id:
        try:
            gallery = supabase.select_single("galleries", columns="photographer_id, job_id", filters={"id": gallery_id})
            if gallery:
                photographer_id = photographer_id or gallery.get("photographer_id")
                job_id = job_id or gallery.get("job_id")
        except Exception as e:
            logger.warning(f"Could not look up gallery: {e}")

    if not photographer_id:
        logger.error("No photographer_id — cannot process")
        await _update_job_status(processing_job_id, "failed", error="Missing photographer_id")
        return

    # Check Modal health
    if use_gpu:
        health = await modal_client.health()
        if health.get("status") != "ok":
            logger.warning(f"Modal unavailable ({health}), GPU phases will be skipped")
            use_gpu = False
        else:
            logger.info("Modal GPU endpoints available")

    # Get style profile info if set
    model_filename = None
    has_style = False
    if style_profile_id:
        try:
            profile = supabase.select_single("style_profiles", filters={"id": style_profile_id})
            if profile:
                mk = profile.get("model_key") or profile.get("model_weights_key")
                if mk:
                    model_filename = mk.split("/")[-1]
                    has_style = True
                    logger.info(f"Using neural style model: {model_filename}")
                else:
                    logger.info("Style profile has no trained model — style phase will be skipped")
        except Exception as e:
            logger.warning(f"Could not load style profile: {e}")

    # Load photos for this gallery
    photos = supabase.select("photos", filters={"gallery_id": gallery_id, "is_culled": False})
    if not photos:
        logger.error(f"No photos found for gallery {gallery_id}")
        await _update_job_status(processing_job_id, "failed", error="No photos found")
        return

    total_photos = len(photos)
    logger.info(f"Starting pipeline: {total_photos} photos, GPU={'enabled' if use_gpu else 'disabled'}")

    # ── In-memory accumulator per photo ──
    # Tracks ai_edits, quality_score, etc. across phases so we don't
    # lose data when merging dicts (the DB is also updated per-phase
    # but the local photo dict from the initial select would be stale).
    photo_state = {}
    for photo in photos:
        photo_state[photo["id"]] = {
            "ai_edits": dict(photo.get("ai_edits") or {}),
            "quality_score": photo.get("quality_score"),
            "face_data": photo.get("face_data") or [],
            "edited_key": photo.get("edited_key"),
            "scene_type": photo.get("scene_type"),
        }

    bucket = settings.storage_bucket

    try:
        # ═══════════════════════════════════════════════════════
        # PHASE 0 — ANALYSIS (CPU)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "analysis", 0)

        for i, photo in enumerate(photos):
            try:
                ps = photo_state[photo["id"]]
                img_bytes = supabase.storage_download(bucket, photo["original_key"])
                if not img_bytes:
                    logger.warning(f"Could not download {photo['original_key']}, skipping")
                    continue

                filename = photo.get("filename", "")
                analysis = analyse_image(img_bytes, filename=filename)

                if analysis.get("error"):
                    logger.warning(f"Phase 0 analysis error for {photo['id']}: {analysis['error']}")
                    await _update_phase(processing_job_id, "analysis", i + 1)
                    continue

                # Cast quality_score to int (DB column is INTEGER CHECK 0-100)
                raw_quality = analysis.get("quality_score", 50)
                quality_int = max(0, min(100, int(round(raw_quality))))

                # Sanitise face_data
                face_data = []
                for face in (analysis.get("face_data") or []):
                    face_data.append({
                        "bbox": [int(v) for v in face.get("bbox", [0, 0, 0, 0])],
                        "eyes_open": bool(face.get("eyes_open", True)),
                    })

                # Sanitise exif_data
                import json as _json
                exif_raw = analysis.get("exif_data") or {}
                exif_clean = {}
                for k, v in exif_raw.items():
                    if isinstance(v, (str, int, float, bool, type(None))):
                        exif_clean[k] = v
                    else:
                        try:
                            _json.dumps(v)
                            exif_clean[k] = v
                        except (TypeError, ValueError):
                            exif_clean[k] = str(v)

                photo_update = {
                    "scene_type": analysis.get("scene_type"),
                    "quality_score": quality_int,
                    "face_data": face_data,
                    "exif_data": exif_clean,
                    "width": int(analysis.get("width", 0)) or None,
                    "height": int(analysis.get("height", 0)) or None,
                }

                # ── RAW file handling: convert to JPEG once, use everywhere ──
                if analysis.get("is_raw"):
                    logger.info(f"RAW file detected: {filename} — converting to JPEG")
                    # Decode full resolution (this is already done inside analyse_image
                    # but we need the full BGR array for JPEG conversion)
                    full_bgr = _decode_image_bytes(img_bytes, filename)
                    if full_bgr is not None:
                        keys = get_output_keys(photographer_id, gallery_id, filename)

                        # Full-res JPEG (working copy for all subsequent phases)
                        _, full_buf = cv2.imencode(".jpg", full_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
                        full_jpeg = full_buf.tobytes()
                        supabase.storage_upload(bucket, keys["edited_key"], full_jpeg)
                        photo_update["edited_key"] = keys["edited_key"]
                        ps["edited_key"] = keys["edited_key"]
                        logger.info(f"RAW→JPEG full-res: {keys['edited_key']} ({len(full_jpeg)/1024/1024:.1f}MB)")

                        # Web preview (2048px max)
                        h, w = full_bgr.shape[:2]
                        if max(h, w) > 2048:
                            scale = 2048 / max(h, w)
                            web_img = cv2.resize(full_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                        else:
                            web_img = full_bgr
                        _, web_buf = cv2.imencode(".jpg", web_img, [cv2.IMWRITE_JPEG_QUALITY, 92])
                        web_jpeg = web_buf.tobytes()
                        supabase.storage_upload(bucket, keys["web_key"], web_jpeg)
                        photo_update["web_key"] = keys["web_key"]

                        # Thumbnail (400px max)
                        if max(h, w) > 400:
                            scale_t = 400 / max(h, w)
                            thumb_img = cv2.resize(full_bgr, (int(w * scale_t), int(h * scale_t)), interpolation=cv2.INTER_AREA)
                        else:
                            thumb_img = full_bgr
                        _, thumb_buf = cv2.imencode(".jpg", thumb_img, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        supabase.storage_upload(bucket, keys["thumb_key"], thumb_buf.tobytes())
                        photo_update["thumb_key"] = keys["thumb_key"]

                        logger.info(f"RAW previews uploaded: web={keys['web_key']}, thumb={keys['thumb_key']}")

                        # Cache the full BGR for later phases (avoid re-download + re-decode)
                        photo["_processed_img"] = full_bgr
                    else:
                        logger.error(f"Failed to decode RAW for JPEG conversion: {filename}")

                # Update DB
                # Update DB
                supabase.update("photos", photo["id"], photo_update)

                # Update local state
                ps["quality_score"] = quality_int
                ps["face_data"] = face_data
                ps["scene_type"] = analysis.get("scene_type")
                if photo_update.get("edited_key"):
                    ps["edited_key"] = photo_update["edited_key"]

                # Cache image bytes for later phases (avoids re-downloading)
                photo["_img_bytes"] = img_bytes

            except Exception as e:
                logger.error(f"Phase 0 failed for photo {photo['id']}: {e}")
            await _update_phase(processing_job_id, "analysis", i + 1)

        # ═══════════════════════════════════════════════════════
        # PHASE 1 — STYLE APPLICATION (GPU — skip if unavailable)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "style", 0)

        if use_gpu and model_filename:
            logger.info(f"Phase 1 (GPU): Applying neural style to {total_photos} images")
            batch_items = []
            for photo in photos:
                if photo.get("original_key"):
                    edited_key = photo["original_key"].replace("/originals/", "/edited/")
                    if not edited_key.lower().endswith((".jpg", ".jpeg")):
                        edited_key = edited_key.rsplit(".", 1)[0] + ".jpg"
                    batch_items.append({
                        "image_key": photo["original_key"],
                        "output_key": edited_key,
                    })

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
                    break

                processed += len(batch)
                await _update_phase(processing_job_id, "style", processed)

                for item, photo in zip(batch, photos[batch_start:batch_start + BATCH_SIZE]):
                    ps = photo_state[photo["id"]]
                    ps["edited_key"] = item["output_key"]
                    ps["ai_edits"]["style_applied"] = "neural_lut"
                    ps["ai_edits"]["has_preset"] = True

                    supabase.update("photos", photo["id"], {
                        "edited_key": item["output_key"],
                        "ai_edits": ps["ai_edits"],
                    })
        else:
            reason = "no GPU" if not use_gpu else "no trained model"
            logger.info(f"Phase 1: Skipped ({reason})")
            # Mark style as not applied
            for photo in photos:
                ps = photo_state[photo["id"]]
                ps["ai_edits"]["style_applied"] = False
                ps["ai_edits"]["has_preset"] = has_style
            await _update_phase(processing_job_id, "style", total_photos)

        # ═══════════════════════════════════════════════════════
        # PHASE 2 — FACE RETOUCHING (GPU)
        # Currently disabled: Modal face_retouch endpoint returns 500.
        # Will re-enable once the endpoint is deployed and tested.
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "retouch", 0)
        logger.info("Phase 2: Face retouching skipped (endpoint not ready)")
        await _update_phase(processing_job_id, "retouch", total_photos)

        # ═══════════════════════════════════════════════════════
        # PHASE 3 — SCENE CLEANUP (GPU)
        # Currently disabled: Modal scene_cleanup endpoint unreliable.
        # Will re-enable once the endpoint is deployed and tested.
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "cleanup", 0)
        logger.info("Phase 3: Scene cleanup skipped (endpoint not ready)")
        await _update_phase(processing_job_id, "cleanup", total_photos)

        # ═══════════════════════════════════════════════════════
        # PHASE 4 — COMPOSITION (CPU) — DISABLED
        # Horizon detection produces too many false positives.
        # Skip entirely until we have a more reliable detection method.
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "composition", 0)
        logger.info("Phase 4: Composition corrections disabled (pending improved detection)")
        for i, photo in enumerate(photos):
            ps = photo_state[photo["id"]]
            ps["ai_edits"]["composition"] = {"evaluated": True, "changes": False, "skipped": True}
            await _update_phase(processing_job_id, "composition", i + 1)

        # ═══════════════════════════════════════════════════════
        # PHASE 5 — QA & OUTPUT (CPU)
        # ═══════════════════════════════════════════════════════
        await _update_phase(processing_job_id, "output", 0)

        for i, photo in enumerate(photos):
            try:
                ps = photo_state[photo["id"]]

                # Get the processed image — prefer cache, avoid re-download
                img_array = photo.get("_processed_img")
                if img_array is None:
                    # Try cached bytes from Phase 0
                    cached_bytes = photo.get("_img_bytes")
                    if cached_bytes:
                        img_array = _decode_image_bytes(cached_bytes, photo.get("filename", ""))
                    else:
                        # Last resort: download
                        source_key = ps["edited_key"] or photo["original_key"]
                        img_bytes = supabase.storage_download(bucket, source_key)
                        if img_bytes:
                            img_array = _decode_image_bytes(img_bytes, photo.get("filename", ""))

                if img_array is None:
                    logger.warning(f"No image data for {photo['id']}, skipping output generation")
                    await _update_phase(processing_job_id, "output", i + 1)
                    continue

                # Generate web + thumb outputs
                outputs = generate_outputs(img_array)
                keys = get_output_keys(photographer_id, gallery_id, photo["filename"])

                # Upload web resolution
                supabase.storage_upload(bucket, keys["web_key"], outputs["web_res"])
                # Upload thumbnail
                supabase.storage_upload(bucket, keys["thumb_key"], outputs["thumbnail"])

                # If no edited_key yet (no GPU style applied), upload full-res as edited
                edited_key = ps["edited_key"]
                if not edited_key:
                    edited_key = keys["edited_key"]
                    supabase.storage_upload(bucket, edited_key, outputs["full_res"])

                # Calculate edit confidence from accumulated state
                quality = ps["quality_score"] or 50
                ai_edits = ps["ai_edits"]

                confidence = min(100, int(quality))
                if ai_edits.get("style_applied") and ai_edits["style_applied"] != False:
                    confidence = min(100, confidence + 5)
                if ai_edits.get("face_retouch"):
                    confidence = min(100, confidence + 3)
                if ai_edits.get("composition", {}).get("horizon_corrected"):
                    confidence = min(100, confidence + 2)

                # Final ai_edits with pipeline metadata
                ai_edits["pipeline_version"] = PIPELINE_VERSION
                ai_edits["has_preset"] = has_style

                # Final photo update — all accumulated data
                supabase.update("photos", photo["id"], {
                    "edited_key": edited_key,
                    "web_key": keys["web_key"],
                    "thumb_key": keys["thumb_key"],
                    "width": outputs.get("full_width"),
                    "height": outputs.get("full_height"),
                    "status": "edited",
                    "edit_confidence": confidence,
                    "ai_edits": ai_edits,
                })

            except Exception as e:
                logger.error(f"Phase 5 failed for {photo['id']}: {e}")
            await _update_phase(processing_job_id, "output", i + 1)

        # ═══════════════════════════════════════════════════════
        # DONE — update statuses
        # ═══════════════════════════════════════════════════════
        elapsed = time.time() - t_start

        # Gallery stays in 'processing' until photographer delivers — DON'T set to 'ready'
        # The 'processing' status keeps it hidden from the Galleries page
        # It becomes 'ready' only when photographer clicks Send to Gallery / Deliver
        supabase.update("galleries", gallery_id, {"status": "processing"})
        if job_id:
            supabase.update("jobs", job_id, {"status": "ready_for_review"})
        await _update_job_status(processing_job_id, "completed")

        # Increment images edited counter for billing tracking
        try:
            from app.config import get_supabase as _get_sb
            _sb = _get_sb()
            import httpx as _httpx
            url = f"{_sb.base_url}/rest/v1/rpc/increment_images_edited"
            resp = _httpx.post(url, headers=_sb.headers, json={
                "photographer_uuid": photographer_id,
                "count": total_photos,
            }, timeout=10)
            if resp.status_code in (200, 204):
                logger.info(f"Incremented images_edited_count by {total_photos}")
            else:
                logger.warning(f"Failed to increment counter: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.warning(f"Failed to increment images edited counter: {e}")

        logger.info(
            f"Pipeline complete: {total_photos} photos in {elapsed:.1f}s "
            f"({elapsed/max(1,total_photos):.1f}s/photo avg), GPU={'yes' if use_gpu else 'no'}"
        )

    except Exception as e:
        logger.error(f"Pipeline failed: {e}\n{traceback.format_exc()}")
        await _update_job_status(processing_job_id, "failed", error=str(e))

    finally:
        await modal_client.close()
        # Clean up cached image data to free memory
        for photo in photos:
            photo.pop("_img_bytes", None)
            photo.pop("_processed_img", None)


# ─── Helper functions ─────────────────────────────────────────────────

async def _update_phase(processing_job_id: str, phase: str, processed_images: int):
    """Update the current phase and progress in the processing_jobs table."""
    try:
        supabase.update("processing_jobs", processing_job_id, {
            "current_phase": phase,
            "processed_images": processed_images,
            "status": "processing",
        })
    except Exception as e:
        logger.warning(f"Failed to update phase progress: {e}")


async def _update_job_status(processing_job_id: str, status: str, error: str = None):
    """Update the processing job status."""
    try:
        data = {"status": status}
        if error:
            data["error_log"] = error
        if status in ("completed", "failed"):
            from datetime import datetime, timezone
            data["completed_at"] = datetime.now(timezone.utc).isoformat()
        supabase.update("processing_jobs", processing_job_id, data)
    except Exception as e:
        logger.warning(f"Failed to update job status: {e}")
