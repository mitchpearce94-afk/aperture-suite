"""
Pipeline Orchestrator

Runs the full AI processing pipeline for a gallery:
    Phase 0: Analysis (EXIF, scene, quality, faces, duplicates)
    Phase 1: Style application (colour grading from learned profile)
    Phase 4: Composition (horizon fix, crop optimisation)
    Phase 5: QA & Output (web-res, thumbnails, top-N selection)

Phases 2 (retouching) and 3 (cleanup) are architecture-ready stubs
that will plug into GPU-accelerated models later.

Updates Supabase in real-time: processing_job status, photo records,
gallery photo_count.
"""
import io
import logging
import traceback
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
    get_style_profile,
)

log = logging.getLogger(__name__)


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    """Decode image bytes to BGR numpy array, handling RAW formats."""
    # Try OpenCV first (fast, handles JPEG/PNG/TIFF)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        return img

    # Try rawpy for RAW formats (CR2, NEF, ARW, etc.)
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

    # Fallback: PIL
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

    Args:
        processing_job_id: ID of the processing_jobs record to update
        gallery_id: Gallery to process
        style_profile_id: Optional style profile for Phase 1
        settings_override: Optional per-job settings overrides
        included_images: Target number of images to select (from package)
    """
    log.info(f"Starting pipeline for gallery {gallery_id} (job {processing_job_id})")

    settings = settings_override or {}
    style_profile = None

    try:
        # Load style profile if specified
        if style_profile_id:
            profile_record = get_style_profile(style_profile_id)
            if profile_record and profile_record.get("status") == "ready":
                style_profile = profile_record.get("settings", {})
                log.info(f"Using style profile: {profile_record.get('name')}")
            else:
                log.warning(f"Style profile {style_profile_id} not ready, proceeding without style")

        # Fetch all photos
        photos = get_gallery_photos(gallery_id)
        if not photos:
            fail_job(processing_job_id, "No photos found in gallery")
            return

        total = len(photos)
        log.info(f"Processing {total} photos")

        # Update job: started
        set_job_phase(processing_job_id, "analysis", 0)

        # ─────────────────────────────────────────────────
        # PHASE 0: Analysis
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

                # Update photo record with analysis results
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
                    "scene_type": result["scene_type"],
                    "face_data": result["face_data"],
                    "phash": result["phash"],
                    "image_bytes": image_bytes,
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
        # IMAGE SELECTION (if target count specified)
        # ─────────────────────────────────────────────────
        if included_images and included_images > 0 and included_images < len(analysis_results):
            log.info(f"Selecting top {included_images} of {len(analysis_results)} images")
            selected_ids = select_top_images(
                [{"id": r["id"], "quality_score": r["quality_score"], "scene_type": r["scene_type"]}
                 for r in analysis_results],
                included_images,
                duplicate_groups,
            )
            # Mark unselected as culled
            all_ids = {r["id"] for r in analysis_results}
            culled_ids = list(all_ids - set(selected_ids))
            if culled_ids:
                bulk_update_photos(culled_ids, is_culled=True, status="rejected")
            # Filter to selected only
            analysis_results = [r for r in analysis_results if r["id"] in selected_ids]

        # ─────────────────────────────────────────────────
        # PHASE 1: Style Application
        # ─────────────────────────────────────────────────
        log.info("Phase 1: Style Application")
        set_job_phase(processing_job_id, "style", len(photos) - len(analysis_results))

        for i, result in enumerate(analysis_results):
            try:
                img = decode_image(result["image_bytes"])
                if img is None:
                    continue

                if style_profile:
                    intensity = settings.get("style_intensity", 0.75)
                    img = apply_style(img, style_profile, intensity=intensity)

                result["processed_img"] = img

            except Exception as e:
                log.error(f"Phase 1 failed for {result['id']}: {e}")
                result["processed_img"] = decode_image(result["image_bytes"])

            set_job_phase(
                processing_job_id, "style",
                len(photos) - len(analysis_results) + i + 1,
            )

        # ─────────────────────────────────────────────────
        # PHASE 2: Face & Skin Retouching (STUB — GPU required)
        # ─────────────────────────────────────────────────
        log.info("Phase 2: Retouching (basic — GPU models not loaded)")
        set_job_phase(processing_job_id, "retouch", 0)

        for i, result in enumerate(analysis_results):
            # Placeholder: basic sharpening as a minimal "retouch"
            img = result.get("processed_img")
            if img is not None and settings.get("retouch_intensity", "light") != "off":
                # Gentle unsharp mask
                blurred = cv2.GaussianBlur(img, (0, 0), 3)
                img = cv2.addWeighted(img, 1.3, blurred, -0.3, 0)
                result["processed_img"] = img

            set_job_phase(processing_job_id, "retouch", i + 1)

        # ─────────────────────────────────────────────────
        # PHASE 3: Scene Cleanup (STUB — GPU required)
        # ─────────────────────────────────────────────────
        log.info("Phase 3: Cleanup (skipped — requires GPU models)")
        set_job_phase(processing_job_id, "cleanup", len(analysis_results))

        # ─────────────────────────────────────────────────
        # PHASE 4: Composition
        # ─────────────────────────────────────────────────
        log.info("Phase 4: Composition")
        set_job_phase(processing_job_id, "composition", 0)

        auto_crop = settings.get("auto_crop", True)

        for i, result in enumerate(analysis_results):
            try:
                img = result.get("processed_img")
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
        # PHASE 5: QA & Output
        # ─────────────────────────────────────────────────
        log.info("Phase 5: QA & Output")
        set_job_phase(processing_job_id, "output", 0)

        # Get gallery info for storage paths
        gallery = get_gallery(gallery_id)
        photographer_id = gallery["photographer_id"] if gallery else "unknown"

        processed_count = 0

        for i, result in enumerate(analysis_results):
            try:
                img = result.get("processed_img")
                if img is None:
                    continue

                # Generate all output sizes
                outputs = generate_outputs(img)
                keys = get_output_keys(photographer_id, gallery_id, result["filename"])

                # Upload to Supabase Storage
                edited_ok = upload_photo(keys["edited_key"], outputs["full_res"])
                web_ok = upload_photo(keys["web_key"], outputs["web_res"])
                thumb_ok = upload_photo(keys["thumb_key"], outputs["thumbnail"])

                if edited_ok and web_ok and thumb_ok:
                    # Update photo record with output keys
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
                            "style_applied": style_profile is not None,
                            "composition": result.get("composition", {}),
                            "pipeline_version": "1.0",
                        },
                    )
                    processed_count += 1
                else:
                    update_photo(result["id"], status="rejected", needs_review=True)

            except Exception as e:
                log.error(f"Phase 5 failed for {result['id']}: {e}")
                update_photo(result["id"], status="rejected", needs_review=True)

            set_job_phase(processing_job_id, "output", i + 1)

            # Free memory — images are large
            result.pop("processed_img", None)
            result.pop("image_bytes", None)

        # ─────────────────────────────────────────────────
        # COMPLETE
        # ─────────────────────────────────────────────────
        log.info(f"Pipeline complete: {processed_count}/{total} photos processed")

        complete_job(processing_job_id, processed_count)

        # Update gallery photo count
        update_gallery(gallery_id, status="ready")

        # Update the shooting job status → ready_for_review
        if gallery and gallery.get("job"):
            job = gallery["job"]
            if isinstance(job, dict):
                update_job_status(job["id"], "ready_for_review")

    except Exception as e:
        log.error(f"Pipeline failed: {e}\n{traceback.format_exc()}")
        fail_job(processing_job_id, str(e))
