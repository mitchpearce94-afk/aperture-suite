"""
Phase 5 — QA & Output

- Generate web-resolution images (2048px max)
- Generate thumbnails (400px max)
- Quality-based image selection (top N based on package's included_images)
- Upload processed outputs to Supabase Storage
"""
import io
import logging
import numpy as np
import cv2
from PIL import Image
from app.config import get_settings

log = logging.getLogger(__name__)


# ── Image Resizing ───────────────────────────────────────────

def resize_image(img_array: np.ndarray, max_dimension: int) -> np.ndarray:
    """Resize image so its longest side is max_dimension pixels, preserving aspect ratio."""
    h, w = img_array.shape[:2]

    if max(h, w) <= max_dimension:
        return img_array

    if w >= h:
        new_w = max_dimension
        new_h = int(h * (max_dimension / w))
    else:
        new_h = max_dimension
        new_w = int(w * (max_dimension / h))

    # Use INTER_AREA for downscaling (best quality)
    return cv2.resize(img_array, (new_w, new_h), interpolation=cv2.INTER_AREA)


def encode_jpeg(img_array: np.ndarray, quality: int = 88) -> bytes:
    """Encode BGR image to JPEG bytes."""
    success, buffer = cv2.imencode(".jpg", img_array, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise ValueError("Failed to encode JPEG")
    return buffer.tobytes()


# ── Output Generation ────────────────────────────────────────

def generate_outputs(img_array: np.ndarray) -> dict:
    """
    Generate all output sizes from a processed image.

    Returns:
        {
            "full_res": bytes,      # Full resolution JPEG
            "web_res": bytes,       # Web resolution (2048px max)
            "thumbnail": bytes,     # Thumbnail (400px max)
            "full_width": int,
            "full_height": int,
            "web_width": int,
            "web_height": int,
            "thumb_width": int,
            "thumb_height": int,
        }
    """
    settings = get_settings()

    # Full resolution
    full_res_bytes = encode_jpeg(img_array, settings.jpeg_quality)
    full_h, full_w = img_array.shape[:2]

    # Web resolution
    web_img = resize_image(img_array, settings.web_res_max_px)
    web_bytes = encode_jpeg(web_img, settings.jpeg_quality)
    web_h, web_w = web_img.shape[:2]

    # Thumbnail
    thumb_img = resize_image(img_array, settings.thumb_max_px)
    thumb_bytes = encode_jpeg(thumb_img, settings.thumb_quality)
    thumb_h, thumb_w = thumb_img.shape[:2]

    return {
        "full_res": full_res_bytes,
        "web_res": web_bytes,
        "thumbnail": thumb_bytes,
        "full_width": full_w,
        "full_height": full_h,
        "web_width": web_w,
        "web_height": web_h,
        "thumb_width": thumb_w,
        "thumb_height": thumb_h,
    }


# ── Image Selection (Top N) ─────────────────────────────────

def select_top_images(
    photos: list[dict],
    target_count: int,
    duplicate_groups: dict[str, list[str]] = None,
) -> list[str]:
    """
    Select the top N images based on quality score, ensuring variety.

    Uses quality_score as primary, with bonuses for:
    - Scene type variety (don't pick 50 portraits if there are ceremony shots)
    - Avoiding duplicates from the same burst group

    Args:
        photos: List of photo dicts with "id", "quality_score", "scene_type"
        target_count: Number of images to select
        duplicate_groups: Output of phase0's group_duplicates()

    Returns:
        List of selected photo IDs
    """
    if not photos:
        return []

    if target_count <= 0 or target_count >= len(photos):
        return [p["id"] for p in photos]

    # Build scoring with diversity bonus
    scored = []
    for photo in photos:
        base_score = photo.get("quality_score", 50)
        scored.append({
            "id": photo["id"],
            "score": base_score,
            "scene_type": photo.get("scene_type", "unknown"),
            "group_id": None,
        })

    # Mark duplicate groups
    if duplicate_groups:
        for group_id, member_ids in duplicate_groups.items():
            for item in scored:
                if item["id"] in member_ids:
                    item["group_id"] = group_id

    # Sort by quality score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    # Greedy selection with diversity constraints
    selected_ids: list[str] = []
    selected_groups: set[str] = set()
    scene_counts: dict[str, int] = {}
    max_per_scene = max(1, target_count // 3)  # No more than 1/3 from one scene type

    for item in scored:
        if len(selected_ids) >= target_count:
            break

        # Skip if we already picked the best from this burst group
        if item["group_id"] and item["group_id"] in selected_groups:
            continue

        # Soft limit on scene type concentration
        scene = item["scene_type"]
        current_count = scene_counts.get(scene, 0)
        if current_count >= max_per_scene and len(selected_ids) < target_count * 0.8:
            # Still room to be selective — skip for now
            continue

        selected_ids.append(item["id"])
        scene_counts[scene] = current_count + 1
        if item["group_id"]:
            selected_groups.add(item["group_id"])

    # If we didn't hit target (due to diversity constraints), fill from remaining
    if len(selected_ids) < target_count:
        for item in scored:
            if item["id"] not in selected_ids:
                selected_ids.append(item["id"])
                if len(selected_ids) >= target_count:
                    break

    return selected_ids


# ── Storage Key Helpers ──────────────────────────────────────

import re


def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage paths — remove special characters."""
    # Remove extension first
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    # Replace anything that's not alphanumeric, dash, underscore, or dot
    safe = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
    # Collapse multiple underscores
    safe = re.sub(r'_+', '_', safe).strip('_')
    return safe or 'photo'


def get_output_keys(photographer_id: str, gallery_id: str, filename: str) -> dict:
    """Generate storage keys for all output variants."""
    base = sanitize_filename(filename)
    prefix = f"{photographer_id}/{gallery_id}"

    return {
        "edited_key": f"{prefix}/edited/{base}.jpg",
        "web_key": f"{prefix}/web/{base}.jpg",
        "thumb_key": f"{prefix}/thumbs/{base}.jpg",
    }
