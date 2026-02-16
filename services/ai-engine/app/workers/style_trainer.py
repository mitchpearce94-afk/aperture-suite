"""
Style Training Worker (v2.0)

Handles async training of style profiles:
1. Validates photographer_id ownership
2. Downloads reference images from Supabase Storage
3. Optionally parses uploaded Lightroom preset (.xmp / .lrtemplate)
4. Trains combined profile (preset baseline + reference learning)
5. Saves profile to DB scoped to photographer_id
"""
import logging
import traceback
import numpy as np
import cv2
from datetime import datetime, timezone

from app.pipeline.phase1_style import compute_channel_stats, load_image_from_bytes
from app.pipeline.preset_parser import parse_preset_file
from app.storage.supabase_storage import download_photo
from app.storage.db import get_style_profile, update_style_profile

log = logging.getLogger(__name__)


def train_profile(profile_id: str):
    """
    Train a style profile from its reference images + optional preset.

    Updates the style_profiles record with:
    - status: training → ready (or error)
    - settings: the computed style profile (JSON)
    - training_started_at / training_completed_at timestamps
    """
    log.info(f"Starting style training for profile {profile_id}")

    try:
        # Mark as training
        update_style_profile(
            profile_id,
            status="training",
            training_started_at=datetime.now(timezone.utc).isoformat(),
        )

        # Fetch profile
        profile = get_style_profile(profile_id)
        if not profile:
            log.error(f"Style profile {profile_id} not found")
            return

        photographer_id = profile.get("photographer_id")
        if not photographer_id:
            update_style_profile(profile_id, status="error")
            log.error("Style profile has no photographer_id — cannot train")
            return

        ref_keys = profile.get("reference_image_keys", [])
        if not ref_keys:
            update_style_profile(profile_id, status="error")
            log.error("No reference images in profile")
            return

        log.info(f"Loading {len(ref_keys)} reference images for photographer {photographer_id}")

        # Validate all reference images belong to this photographer
        # (keys should start with photographer_id/)
        valid_keys = []
        for key in ref_keys:
            if key.startswith(f"{photographer_id}/"):
                valid_keys.append(key)
            else:
                log.warning(f"Skipping reference image not owned by photographer: {key}")

        if not valid_keys:
            # Fallback: accept all keys (legacy data may not have photographer prefix)
            log.warning("No keys matched photographer prefix — using all keys (legacy mode)")
            valid_keys = ref_keys

        # Download, decode, and compute stats one image at a time (memory safe)
        # Don't hold all images in memory — compute stats per image and accumulate
        all_stats = []
        valid_count = 0
        TRAIN_MAX_DIM = 800  # Resize for stats computation — saves memory

        for key in valid_keys:
            try:
                data = download_photo(key)
                if data:
                    img = load_image_from_bytes(data)
                    del data  # Free raw bytes
                    if img is not None:
                        # Resize for stats computation
                        h, w = img.shape[:2]
                        if max(h, w) > TRAIN_MAX_DIM:
                            scale = TRAIN_MAX_DIM / max(h, w)
                            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                        stats = compute_channel_stats(img)
                        all_stats.append(stats)
                        del img  # Free image immediately
                        valid_count += 1
            except Exception as e:
                log.warning(f"Failed to load reference image {key}: {e}")

        if valid_count < 10:
            update_style_profile(profile_id, status="error")
            log.error(f"Only {valid_count} valid reference images — need at least 10")
            return

        # Check for uploaded preset file
        preset_params = None
        preset_key = profile.get("settings", {}).get("preset_file_key")
        if preset_key:
            log.info(f"Loading preset file: {preset_key}")
            try:
                preset_data = download_photo(preset_key)
                if preset_data:
                    preset_content = preset_data.decode("utf-8", errors="replace")
                    preset_params = parse_preset_file(preset_content, preset_key)
                    if preset_params:
                        log.info(f"Parsed {len(preset_params)} preset parameters")
                    else:
                        log.warning("Preset file parsed but no parameters extracted")
            except Exception as e:
                log.warning(f"Failed to parse preset file: {e}")

        log.info(f"Training style from {valid_count} images"
                 f"{f' + {len(preset_params)} preset params' if preset_params else ''}")

        # Build profile from pre-computed stats (v2.0 — preset + reference)
        profile_data = {"version": "2.0", "has_preset": preset_params is not None}

        if preset_params:
            profile_data["preset"] = preset_params

        if all_stats:
            ref = {}
            for key in all_stats[0].keys():
                vals = [s[key] for s in all_stats if key in s]
                if isinstance(vals[0], list):
                    ref[key] = np.mean(np.array(vals), axis=0).tolist()
                else:
                    ref[key] = float(np.mean(vals))
            profile_data["reference"] = ref
            profile_data["num_reference_images"] = valid_count

        style_data = profile_data

        if "error" in style_data:
            update_style_profile(profile_id, status="error")
            return

        # Save the trained profile
        update_style_profile(
            profile_id,
            status="ready",
            settings=style_data,
            training_completed_at=datetime.now(timezone.utc).isoformat(),
        )

        log.info(f"Style profile {profile_id} training complete — ready to use")

    except Exception as e:
        log.error(f"Style training failed: {e}\n{traceback.format_exc()}")
        update_style_profile(profile_id, status="error")
