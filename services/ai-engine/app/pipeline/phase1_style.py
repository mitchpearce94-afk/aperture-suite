"""
Phase 1 — Style Application

Learns a photographer's editing style from 50-200+ reference images, then applies
it to new photos. This is the core value proposition.

How it works:
1. TRAINING: Analyse reference images to build a "style profile" — statistical
   model of the photographer's colour grading preferences:
   - Histogram distribution per channel (R, G, B, L)
   - White balance offsets (warm/cool tendency)
   - Contrast curve (shadows, midtones, highlights)
   - Saturation/vibrance levels
   - Tonal range preferences (crushed blacks, lifted shadows, etc.)
   - Colour channel relationships (cross-channel tendencies)

2. APPLICATION: Match new images to the learned style using:
   - Histogram matching (primary method — fast and effective)
   - White balance correction toward learned preference
   - Contrast curve application
   - Colour saturation adjustment

This runs on CPU and produces results comparable to Lightroom preset application,
which is what most photographers want as a starting point.
"""
import io
import json
import logging
import numpy as np
import cv2
from PIL import Image
from typing import Optional

log = logging.getLogger(__name__)


# ── Style Profile Training ───────────────────────────────────

def compute_channel_stats(img_array: np.ndarray) -> dict:
    """Compute per-channel statistics for a single image."""
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

    # Work in LAB colour space (perceptually uniform)
    lab = cv2.cvtColor(img_array, cv2.COLOR_BGR2LAB).astype(float)
    bgr = img_array.astype(float)
    hsv = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV).astype(float)

    stats = {}

    # Per-channel histograms (256 bins)
    for i, name in enumerate(["b", "g", "r"]):
        channel = bgr[:, :, i]
        hist, _ = np.histogram(channel, bins=256, range=(0, 256))
        hist = hist.astype(float) / hist.sum()
        stats[f"hist_{name}"] = hist.tolist()
        stats[f"mean_{name}"] = float(np.mean(channel))
        stats[f"std_{name}"] = float(np.std(channel))

    # LAB stats
    for i, name in enumerate(["l", "a", "b_lab"]):
        channel = lab[:, :, i]
        hist, _ = np.histogram(channel, bins=256, range=(0, 256))
        hist = hist.astype(float) / hist.sum()
        stats[f"hist_{name}"] = hist.tolist()
        stats[f"mean_{name}"] = float(np.mean(channel))
        stats[f"std_{name}"] = float(np.std(channel))

    # HSV stats
    stats["mean_saturation"] = float(np.mean(hsv[:, :, 1]))
    stats["mean_value"] = float(np.mean(hsv[:, :, 2]))
    stats["std_saturation"] = float(np.std(hsv[:, :, 1]))

    # Contrast metrics
    stats["shadow_mean"] = float(np.mean(lab[:, :, 0][lab[:, :, 0] < 85]))  # Bottom third
    stats["midtone_mean"] = float(np.mean(lab[:, :, 0][(lab[:, :, 0] >= 85) & (lab[:, :, 0] <= 170)]))
    stats["highlight_mean"] = float(np.mean(lab[:, :, 0][lab[:, :, 0] > 170])) if np.any(lab[:, :, 0] > 170) else 200.0

    # White balance indicator (a/b channels in LAB)
    stats["wb_a"] = float(np.mean(lab[:, :, 1]))  # Green-Red axis
    stats["wb_b"] = float(np.mean(lab[:, :, 2]))  # Blue-Yellow axis

    return stats


def train_style_profile(reference_images: list[np.ndarray]) -> dict:
    """
    Build a style profile from reference images.

    Computes aggregate statistics across all reference images to create
    a target distribution the AI will match new photos toward.

    Returns a JSON-serialisable dict that can be stored in the DB.
    """
    if not reference_images:
        return {"error": "No reference images provided"}

    log.info(f"Training style from {len(reference_images)} reference images")

    all_stats = [compute_channel_stats(img) for img in reference_images]

    # Aggregate: compute mean of all stats
    profile = {}
    keys = all_stats[0].keys()

    for key in keys:
        values = [s[key] for s in all_stats if key in s]
        if isinstance(values[0], list):
            # Histogram: average across images
            arr = np.array(values)
            profile[key] = np.mean(arr, axis=0).tolist()
        else:
            profile[key] = float(np.mean(values))

    profile["num_reference_images"] = len(reference_images)
    profile["version"] = "1.0"

    return profile


# ── Style Application ────────────────────────────────────────

def histogram_match_channel(source: np.ndarray, target_hist: np.ndarray) -> np.ndarray:
    """Match source channel histogram to target distribution."""
    # Compute source CDF
    source_hist, _ = np.histogram(source.flatten(), bins=256, range=(0, 256))
    source_cdf = np.cumsum(source_hist).astype(float)
    source_cdf /= source_cdf[-1]

    # Compute target CDF
    target_cdf = np.cumsum(target_hist).astype(float)
    target_cdf /= target_cdf[-1]

    # Build mapping
    mapping = np.zeros(256, dtype=np.uint8)
    for src_val in range(256):
        # Find closest target value where CDFs match
        diff = np.abs(source_cdf[src_val] - target_cdf)
        mapping[src_val] = np.argmin(diff)

    return mapping[source]


def apply_style(img_array: np.ndarray, style_profile: dict, intensity: float = 0.55) -> np.ndarray:
    """
    Apply a learned style profile to an image.

    Args:
        img_array: BGR image (OpenCV format)
        style_profile: The trained profile dict
        intensity: How strongly to apply (0.0 = no change, 1.0 = full match)

    Returns:
        Styled BGR image
    """
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

    original = img_array.copy()
    result = img_array.copy().astype(float)

    # Build skin mask to protect skin tones from aggressive shifts
    hsv_orig = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(img_array, cv2.COLOR_BGR2YCrCb)
    # Skin detection in YCrCb (more reliable across lighting)
    skin_mask = (
        (ycrcb[:, :, 1] >= 133) & (ycrcb[:, :, 1] <= 173) &
        (ycrcb[:, :, 2] >= 77) & (ycrcb[:, :, 2] <= 127)
    ).astype(float)
    # Blur mask for smooth transitions
    skin_mask = cv2.GaussianBlur(skin_mask, (21, 21), 0)
    # Reduce intensity on skin areas (apply only 40% of the style shift to skin)
    skin_protection = 1.0 - (skin_mask * 0.6)

    # 1. Histogram matching per BGR channel
    for i, name in enumerate(["b", "g", "r"]):
        hist_key = f"hist_{name}"
        if hist_key in style_profile:
            target_hist = np.array(style_profile[hist_key])
            matched = histogram_match_channel(img_array[:, :, i], target_hist).astype(float)
            # Apply with skin protection — less matching on skin
            channel_intensity = intensity * skin_protection
            result[:, :, i] = original[:, :, i].astype(float) * (1 - channel_intensity) + matched * channel_intensity

    result = np.clip(result, 0, 255).astype(np.uint8)

    # 2. White balance adjustment
    if "wb_a" in style_profile and "wb_b" in style_profile:
        lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB).astype(float)

        current_a = np.mean(lab[:, :, 1])
        current_b = np.mean(lab[:, :, 2])
        target_a = style_profile["wb_a"]
        target_b = style_profile["wb_b"]

        # Shift a/b channels toward target (scaled by intensity)
        wb_strength = intensity * 0.35  # WB is subtle — don't overcorrect
        lab[:, :, 1] += (target_a - current_a) * wb_strength
        lab[:, :, 2] += (target_b - current_b) * wb_strength
        lab = np.clip(lab, 0, 255).astype(np.uint8)

        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3. Saturation adjustment
    if "mean_saturation" in style_profile:
        hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(float)
        current_sat = np.mean(hsv[:, :, 1])
        target_sat = style_profile["mean_saturation"]

        if current_sat > 0:
            sat_ratio = target_sat / (current_sat + 1e-6)
            # Limit range to avoid extreme shifts
            sat_ratio = max(0.7, min(1.5, sat_ratio))
            sat_adjustment = 1.0 + (sat_ratio - 1.0) * intensity * 0.5
            hsv[:, :, 1] *= sat_adjustment
            hsv = np.clip(hsv, 0, 255).astype(np.uint8)
            result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # 4. Contrast/tonality (shadow lift, highlight compression)
    if "shadow_mean" in style_profile:
        lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB).astype(float)
        L = lab[:, :, 0]

        current_shadow = np.mean(L[L < 85]) if np.any(L < 85) else 40
        target_shadow = style_profile.get("shadow_mean", 40)

        # Lift shadows if the reference style has lifted shadows
        if target_shadow > current_shadow:
            shadow_mask = (L < 85).astype(float)
            lift = (target_shadow - current_shadow) * intensity * 0.3
            L += shadow_mask * lift

        lab[:, :, 0] = np.clip(L, 0, 255)
        lab = lab.astype(np.uint8)
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    return result


# ── Convenience: Load Reference Images ───────────────────────

def load_image_from_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Decode image bytes to BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        return img

    # Fallback for formats OpenCV can't handle
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = pil_img.convert("RGB")
        return np.array(pil_img)[:, :, ::-1]  # RGB → BGR
    except Exception:
        return None
