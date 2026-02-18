"""
Pipeline Orchestrator (GPU-enabled)

Runs the full AI processing pipeline for a gallery:
    Phase 0: Analysis (EXIF, scene, quality, faces, duplicates) — CPU
    Phase 1: Style application (GPU neural LUT via Modal, or skip) — GPU
    Phase 2: Face & Skin Retouching (GPU CodeFormer via Modal, or skip) — GPU
    Phase 3: Scene Cleanup (GPU LaMa via Modal, or skip) — GPU
    Phase 4: Composition (horizon fix, crop optimisation) — CPU
    Phase 5: QA & Output (web-res, thumbnails, top-N selection) — CPU

Updates Supabase in real-time: processing_job status, photo records,
gallery photo_count.
"""
import io
import logging
import traceback
import httpx
import os
from datetime import datetime, timezone

import numpy as np
import cv2
from PIL import Image

from app.pipeline.phase0_analysis import analyse_image, group_duplicates
from app.pipeline.phase1_style import apply_style, load_image_from_bytes
from app.pipeline.phase4_composition import fix_composition
from app.pipeline.phase5_output import generate_outputs, select_top_images, get_output_keys
from app.storage.supabase_storage import download_photo, upload_photo
from app.storage.db import (
    get_gallery_photos, update_photo, bulk_update_photos,
    set_job_phase, complete_job, fail_job,
    get_gallery, update_gallery, update_job_status,
    get_style_profile, get_photographer_default_style,
    validate_style_profile_ownership,
)

log = logging.getLogger(__name__)

# Max dimension for processing — keeps memory under ~200MB per image
PROCESSING_MAX_DIM = 2048

# Modal GPU endpoint base URL
MODAL_BASE_URL = os.environ.get("MODAL_BASE_URL", "")


def _modal_available() -> bool:
    """Check if Modal GPU endpoints are configured and reachable."""
    if not MODAL_BASE_URL:
        return False
    try:
        # Derive health URL from base URL
        health_url = MODAL_BASE_URL
        if "health" not in health_url:
            # Base URL might be any endpoint — construct health URL
            parts = health_url.rsplit("--", 1)
            if len(parts) == 2:
                health_url = f"{parts[0]}--apelier-gpu-health.modal.run"
        resp = httpx.get(health_url, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        log.warning(f"Modal health check failed: {e}")
        return False


def _modal_endpoint(function_name: str) -> str:
    """Build Modal endpoint URL for a given function."""
    if not MODAL_BASE_URL:
        return ""
    parts = MODAL_BASE_URL.rsplit("--", 1)
    if len(parts) == 2:
        return f"{parts[0]}--apelier-gpu-{function_name.replace('_', '-')}.modal.run"
    return f"{MODAL_BASE_URL}/{function_name}"


def _get_supabase_creds() -> tuple[str, str, str]:
    """Get Supabase credentials for Modal calls."""
    from app.config import get_settings
    s = get_settings()
    return s.supabase_url, s.supabase_service_role_key, s.storage_bucket


def resize_for_processing(img: np.ndarray, max_dim: int = PROCESSING_MAX_DIM) -> np.ndarray:
    """Resize image to fit within max_dim while preserving aspect ratio."""
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    """Decode image bytes to BGR numpy array, handling RAW formats."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        return img

    try:
        import rawpy
        raw = rawpy.imread(io.BytesIO(image_bytes))
        rgb = raw.postprocess(
            use_camera_wb=True,
            half_size=False,
            no_auto_bright=True,
            output_bps=8,
        )
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        pass

    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = pil_img.convert("RGB")
        return np.array(pil_img)[:, :, ::-1]
    except Exception:
        return None


def run_pipeline(
    processing_job_id: str,
    gallery_id: str,
    style_profile_id: str | None = None,
    settings_override: dict | None = None,
    included_images: int | None = None,
):
    """
    Main pipeline entry point. Processes all photos in a gallery.

    GPU-enabled: Routes Phase 1 through Modal neural LUT when a trained
    model exists. Phases 2/3 use Modal CodeFormer/LaMa when GPU available.
    No CPU fallback for style — GPU or skip.
    """
    log.info(f"Starting pipeline for gallery {gallery_id} (job {processing_job_id})")

    settings = settings_override or {}
    style_profile = None
    style_profile_record = None

    try:
        # Fetch gallery to get photographer_id
        gallery = get_gallery(gallery_id)
        if not gallery:
            fail_job(processing_job_id, f"Gallery {gallery_id} not found")
            return

        photographer_id = gallery["photographer_id"]
        log.info(f"Photographer: {photographer_id}")

        # ── STYLE PROFILE ISOLATION ──────────────────────
        if style_profile_id:
            if not validate_style_profile_ownership(style_profile_id, photographer_id):
                log.warning(
                    f"Style profile {style_profile_id} does not belong to "
                    f"photographer {photographer_id} — ignoring"
                )
                style_profile_id = None
            else:
                profile_record = get_style_profile(style_profile_id)
                if profile_record and profile_record.get("status") == "ready":
                    style_profile = profile_record.get("settings", {})
                    style_profile_record = profile_record
                    log.info(f"Using style profile: {profile_record.get('name')}")
                else:
                    log.warning(f"Style profile {style_profile_id} not ready")

        # Auto-select photographer's default style if none specified/valid
        if not style_profile:
            default = get_photographer_default_style(photographer_id)
            if default:
                style_profile = default.get("settings", {})
                style_profile_record = default
                log.info(f"Auto-selected photographer's default style: {default.get('name')}")
            else:
                log.info("No style profile available — processing without style")

        # Check if this style profile has a neural model (GPU training)
        has_neural_model = (
            style_profile_record is not None
            and style_profile_record.get("model_filename")
            and style_profile_record.get("training_method") == "neural_lut"
        )

        # Check Modal GPU availability
        use_gpu = _modal_available()
        if use_gpu:
            log.info("Modal GPU endpoints available")
        else:
            log.info("Modal GPU not available — Phases 2/3 will be skipped")

        # Fetch all photos — skip already-processed ones (have edited_key)
        all_photos = get_gallery_photos(gallery_id)
        photos = [p for p in all_photos if not p.get("edited_key")]
        if not photos:
            if all_photos:
                log.info("All photos already processed — nothing new to process")
                complete_job(processing_job_id, 0)
                return
            fail_job(processing_job_id, "No photos found in gallery")
            return

        total = len(photos)
        log.info(f"Processing {total} photos (GPU={'yes' if use_gpu else 'no'}, neural_model={'yes' if has_neural_model else 'no'})")

        set_job_phase(processing_job_id, "analysis", 0)

        # ─────────────────────────────────────────────────
        # PHASE 0: Analysis (CPU — same as before)
        # ─────────────────────────────────────────────────
        log.info("Phase 0: Analysis")
        analysis_results = []

        for i, photo in enumerate(photos):
            try:
                image_bytes = download_photo(photo["original_key"])
                if not image_bytes:
                    log.warning(f"Could not download photo {photo['id']}")
                    update_photo(photo["id"], status="rejected", needs_review=True)
                    continue

                result = analyse_image(image_bytes)

                if "error" in result:
                    update_photo(photo["id"], status="rejected", needs_review=True)
                    continue

                update_photo(
                    photo["id"],
                    exif_data=result["exif_data"],
                    scene_type=result["scene_type"],
                    quality_score=int(result["quality_score"]),
                    face_data=result["face_data"],
                    width=int(result["width"]),
                    height=int(result["height"]),
                    status="processing",
                )

                analysis_results.append({
                    "id": photo["id"],
                    "original_key": photo["original_key"],
                    "filename": photo.get("filename", "unknown"),
                    "quality_score": result["quality_score"],
                    "quality_details": result["quality_details"],
                    "scene_type": result["scene_type"],
                    "face_data": result["face_data"],
                    "face_count": result["face_count"],
                    "characteristics": result.get("characteristics", {}),
                    "phash": result["phash"],
                })

            except Exception as e:
                log.error(f"Phase 0 failed for photo {photo['id']}: {e}")
                update_photo(photo["id"], status="rejected", needs_review=True)

            set_job_phase(processing_job_id, "analysis", i + 1)

        if not analysis_results:
            fail_job(processing_job_id, "All photos failed analysis")
            return

        # Duplicate grouping
        duplicate_groups = group_duplicates(
            [{"id": r["id"], "_phash": r["phash"]} for r in analysis_results]
        )

        # ─────────────────────────────────────────────────
        # IMAGE SELECTION
        # ─────────────────────────────────────────────────
        if included_images and included_images > 0 and included_images < len(analysis_results):
            log.info(f"Selecting top {included_images} of {len(analysis_results)} images")
            selected_ids = select_top_images(
                [{"id": r["id"], "quality_score": r["quality_score"], "scene_type": r["scene_type"]}
                 for r in analysis_results],
                included_images,
                duplicate_groups,
            )
            all_ids = {r["id"] for r in analysis_results}
            culled_ids = list(all_ids - set(selected_ids))
            if culled_ids:
                bulk_update_photos(culled_ids, is_culled=True, status="rejected")
            analysis_results = [r for r in analysis_results if r["id"] in selected_ids]

        # ─────────────────────────────────────────────────
        # PHASE 1: Style Application
        # GPU neural LUT via Modal if available, otherwise skip
        # ─────────────────────────────────────────────────
        log.info("Phase 1: Style Application")
        set_job_phase(processing_job_id, "style", len(photos) - len(analysis_results))

        if use_gpu and has_neural_model:
            # ── GPU PATH: batch through Modal ──
            model_filename = style_profile_record["model_filename"]
            supabase_url, supabase_key, bucket = _get_supabase_creds()
            batch_url = _modal_endpoint("apply_style_batch")

            log.info(f"Phase 1 (GPU): Neural style via Modal — {len(analysis_results)} images, model={model_filename}")

            BATCH_SIZE = 20
            gpu_style_ok = True

            for batch_start in range(0, len(analysis_results), BATCH_SIZE):
                batch = analysis_results[batch_start:batch_start + BATCH_SIZE]
                batch_items = []
                for r in batch:
                    edited_key = r["original_key"].replace("uploads/", "edited/")
                    batch_items.append({
                        "image_key": r["original_key"],
                        "output_key": edited_key,
                    })
                    r["_edited_key"] = edited_key  # Store for Phase 5

                try:
                    resp = httpx.post(batch_url, json={
                        "images": batch_items,
                        "model_filename": model_filename,
                        "supabase_url": supabase_url,
                        "supabase_key": supabase_key,
                        "bucket": bucket,
                        "jpeg_quality": 95,
                    }, timeout=600)

                    result = resp.json()
                    if result.get("status") == "error":
                        log.error(f"GPU style batch failed: {result.get('message')}")
                        gpu_style_ok = False
                        break

                    # Mark photos with edited keys
                    for r in batch:
                        update_photo(r["id"],
                            edited_key=r["_edited_key"],
                            ai_edits={"style": "neural_lut", "pipeline_version": "3.0-gpu"},
                            status="processing",
                        )
                        r["_gpu_styled"] = True

                except Exception as e:
                    log.error(f"GPU style batch error: {e}")
                    gpu_style_ok = False
                    break

                set_job_phase(
                    processing_job_id, "style",
                    len(photos) - len(analysis_results) + batch_start + len(batch),
                )

            if not gpu_style_ok:
                log.warning("GPU style failed — photos will proceed without style application")

        else:
            if not has_neural_model:
                log.info("Phase 1: No neural model trained — skipping style application")
            else:
                log.info("Phase 1: GPU unavailable — skipping style application")

        # For photos that didn't get GPU styled, we still need to download them for Phase 4/5
        set_job_phase(processing_job_id, "style", len(photos))

        # ─────────────────────────────────────────────────
        # PHASE 2: Face & Skin Retouching (GPU or skip)
        # ─────────────────────────────────────────────────
        log.info("Phase 2: Retouching")
        set_job_phase(processing_job_id, "retouch", 0)

        if use_gpu:
            supabase_url, supabase_key, bucket = _get_supabase_creds()
            retouch_url = _modal_endpoint("face_retouch")

            for i, result in enumerate(analysis_results):
                face_data = result.get("face_data", [])
                edited_key = result.get("_edited_key") or result["original_key"].replace("uploads/", "edited/")

                if face_data and len(face_data) > 0:
                    try:
                        resp = httpx.post(retouch_url, json={
                            "image_key": edited_key,
                            "output_key": edited_key,
                            "supabase_url": supabase_url,
                            "supabase_key": supabase_key,
                            "bucket": bucket,
                            "fidelity": 0.7,
                        }, timeout=120)
                        r = resp.json()
                        if r.get("status") == "success" and r.get("faces_found", 0) > 0:
                            result["_retouched"] = True
                    except Exception as e:
                        log.error(f"Phase 2 failed for {result['id']}: {e}")

                set_job_phase(processing_job_id, "retouch", i + 1)
        else:
            log.info("Phase 2: Skipped (GPU unavailable)")
            set_job_phase(processing_job_id, "retouch", len(analysis_results))

        # ─────────────────────────────────────────────────
        # PHASE 3: Scene Cleanup (GPU or skip)
        # ─────────────────────────────────────────────────
        log.info("Phase 3: Cleanup")
        set_job_phase(processing_job_id, "cleanup", 0)

        if use_gpu:
            supabase_url, supabase_key, bucket = _get_supabase_creds()
            cleanup_url = _modal_endpoint("scene_cleanup")

            for i, result in enumerate(analysis_results):
                edited_key = result.get("_edited_key") or result["original_key"].replace("uploads/", "edited/")
                try:
                    resp = httpx.post(cleanup_url, json={
                        "image_key": edited_key,
                        "output_key": edited_key,
                        "supabase_url": supabase_url,
                        "supabase_key": supabase_key,
                        "bucket": bucket,
                        "detections": ["power_lines", "exit_signs"],
                    }, timeout=120)
                    r = resp.json()
                    if r.get("status") == "success" and r.get("detections_found", 0) > 0:
                        result["_cleaned"] = True
                except Exception as e:
                    log.error(f"Phase 3 failed for {result['id']}: {e}")

                set_job_phase(processing_job_id, "cleanup", i + 1)
        else:
            log.info("Phase 3: Skipped (GPU unavailable)")
            set_job_phase(processing_job_id, "cleanup", len(analysis_results))

        # ─────────────────────────────────────────────────
        # PHASE 4: Composition (CPU)
        # ─────────────────────────────────────────────────
        log.info("Phase 4: Composition")
        set_job_phase(processing_job_id, "composition", 0)

        auto_crop = settings.get("auto_crop", True)

        for i, result in enumerate(analysis_results):
            try:
                # If GPU styled, download the edited image from storage
                if result.get("_gpu_styled"):
                    edited_key = result["_edited_key"]
                    raw = download_photo(edited_key)
                else:
                    # No GPU style — use original
                    raw = download_photo(result["original_key"])

                if not raw:
                    continue
                img = decode_image(raw)
                del raw
                if img is None:
                    continue

                img, comp_meta = fix_composition(
                    img,
                    face_boxes=result.get("face_data", []),
                    auto_crop=auto_crop,
                )
                result["processed_img"] = img
                result["composition"] = comp_meta

            except Exception as e:
                log.error(f"Phase 4 failed for {result['id']}: {e}")

            set_job_phase(processing_job_id, "composition", i + 1)

        # ─────────────────────────────────────────────────
        # PHASE 5: QA & Output (CPU)
        # ─────────────────────────────────────────────────
        log.info("Phase 5: QA & Output")
        set_job_phase(processing_job_id, "output", 0)

        processed_count = 0

        for i, result in enumerate(analysis_results):
            try:
                img = result.get("processed_img")
                if img is None:
                    continue

                outputs = generate_outputs(img)
                keys = get_output_keys(photographer_id, gallery_id, result["filename"])

                edited_ok = upload_photo(keys["edited_key"], outputs["full_res"])
                web_ok = upload_photo(keys["web_key"], outputs["web_res"])
                thumb_ok = upload_photo(keys["thumb_key"], outputs["thumbnail"])

                if edited_ok and web_ok and thumb_ok:
                    update_photo(
                        result["id"],
                        edited_key=keys["edited_key"],
                        web_key=keys["web_key"],
                        thumb_key=keys["thumb_key"],
                        width=outputs["full_width"],
                        height=outputs["full_height"],
                        status="edited",
                        edit_confidence=int(result.get("quality_score", 75)),
                        ai_edits={
                            "style_applied": has_neural_model and result.get("_gpu_styled", False),
                            "style_method": "neural_lut" if result.get("_gpu_styled") else "none",
                            "face_retouched": result.get("_retouched", False),
                            "scene_cleaned": result.get("_cleaned", False),
                            "composition": result.get("composition", {}),
                            "pipeline_version": "3.0-gpu" if use_gpu else "2.0",
                        },
                    )
                    processed_count += 1
                else:
                    update_photo(result["id"], status="rejected", needs_review=True)

            except Exception as e:
                log.error(f"Phase 5 failed for {result['id']}: {e}")
                update_photo(result["id"], status="rejected", needs_review=True)

            set_job_phase(processing_job_id, "output", i + 1)

            result.pop("processed_img", None)
            result.pop("image_bytes", None)

        # ─────────────────────────────────────────────────
        # COMPLETE
        # ─────────────────────────────────────────────────
        log.info(f"Pipeline complete: {processed_count}/{total} photos processed (GPU={'yes' if use_gpu else 'no'})")

        complete_job(processing_job_id, processed_count)
        update_gallery(gallery_id, status="ready")

        if gallery and gallery.get("job"):
            job = gallery["job"]
            if isinstance(job, dict):
                update_job_status(job["id"], "ready_for_review")

    except Exception as e:
        log.error(f"Pipeline failed: {e}\n{traceback.format_exc()}")
        fail_job(processing_job_id, str(e))
