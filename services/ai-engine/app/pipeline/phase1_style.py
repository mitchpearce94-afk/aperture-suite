"""
Phase 1 — Style Application (v2.0)

Two-tier style application:
  Tier A: Lightroom preset as baseline (XMP/lrtemplate → ~50-80 parameters)
  Tier B: Reference image learning on top (luminance-preserving colour transfer)

Runs on CPU. No GPU required.
"""
import io
import logging
from typing import Optional

import cv2
import numpy as np
from PIL import Image

from app.pipeline.preset_parser import parse_preset_file

log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# PRESET APPLICATION ENGINE
# ═══════════════════════════════════════════════════════════════

def apply_preset_params(img: np.ndarray, preset: dict, intensity: float = 1.0) -> np.ndarray:
    """Apply parsed Lightroom preset parameters to an image."""
    if not preset:
        return img
    result = img.copy().astype(np.float32)

    # --- Exposure (stops) ---
    exp = preset.get('exposure', 0.0)
    if abs(exp) > 0.01:
        result *= 2.0 ** (exp * intensity)

    # --- Temperature / Tint ---
    temp, tint = preset.get('temperature', 0.0), preset.get('tint', 0.0)
    if abs(temp) > 0.5 or abs(tint) > 0.5:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        lab[:, :, 2] += (temp / 100.0) * 10.0 * intensity
        lab[:, :, 1] += (tint / 100.0) * 8.0 * intensity
        result = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- Contrast (S-curve on luminance) ---
    con = preset.get('contrast', 0.0)
    if abs(con) > 0.5:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        amt = (con / 100.0) * intensity
        lab[:, :, 0] = np.clip((L - 128.0) * (1.0 + amt * 0.5) + 128.0, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- Highlights / Shadows / Whites / Blacks ---
    hi = preset.get('highlights', 0.0)
    sh = preset.get('shadows', 0.0)
    wh = preset.get('whites', 0.0)
    bl = preset.get('blacks', 0.0)
    if any(abs(v) > 0.5 for v in [hi, sh, wh, bl]):
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        if abs(hi) > 0.5:
            L += np.clip((L - 192.0) / 63.0, 0, 1) * (hi / 100.0) * 40.0 * intensity
        if abs(sh) > 0.5:
            L += np.clip((63.0 - L) / 63.0, 0, 1) * (sh / 100.0) * 40.0 * intensity
        if abs(wh) > 0.5:
            L += np.clip((L - 230.0) / 25.0, 0, 1) * (wh / 100.0) * 30.0 * intensity
        if abs(bl) > 0.5:
            L += np.clip((25.0 - L) / 25.0, 0, 1) * (bl / 100.0) * 30.0 * intensity
        lab[:, :, 0] = np.clip(L, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- HSL adjustments ---
    hsl_keys = [k for k in preset if k.startswith('hsl_')]
    if hsl_keys:
        hsv = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        ranges = {
            'red': (0, 15, 165, 180), 'orange': (15, 30), 'yellow': (30, 45),
            'green': (45, 90), 'aqua': (90, 105), 'blue': (105, 135),
            'purple': (135, 150), 'magenta': (150, 165),
        }
        for color, hr in ranges.items():
            dh = preset.get(f'hsl_hue_{color}', 0.0)
            ds = preset.get(f'hsl_sat_{color}', 0.0)
            dl = preset.get(f'hsl_lum_{color}', 0.0)
            if all(abs(v) < 0.5 for v in [dh, ds, dl]):
                continue
            if len(hr) == 4:
                mask = ((H >= hr[0]) & (H < hr[1])) | ((H >= hr[2]) & (H <= hr[3]))
            else:
                mask = (H >= hr[0]) & (H < hr[1])
            mf = cv2.GaussianBlur(mask.astype(np.float32), (5, 5), 0)
            if abs(dh) > 0.5:
                H += mf * (dh / 100.0) * 15.0 * intensity
            if abs(ds) > 0.5:
                S += mf * (ds / 100.0) * 50.0 * intensity
            if abs(dl) > 0.5:
                V += mf * (dl / 100.0) * 40.0 * intensity
        hsv[:, :, 0] = H % 180
        hsv[:, :, 1] = np.clip(S, 0, 255)
        hsv[:, :, 2] = np.clip(V, 0, 255)
        result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)

    # --- Split toning ---
    hh_sat = preset.get('split_highlight_sat', 0.0)
    sh_sat = preset.get('split_shadow_sat', 0.0)
    if hh_sat > 0.5 or sh_sat > 0.5:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        bal = preset.get('split_balance', 0.0)
        mid = 128.0 + bal * 0.5
        if hh_sat > 0.5:
            m = np.clip((L - mid) / (255.0 - mid + 1e-6), 0, 1)
            rad = preset.get('split_highlight_hue', 0.0) / 360.0 * 2 * np.pi
            lab[:, :, 1] += m * np.cos(rad) * hh_sat / 100.0 * 20.0 * intensity
            lab[:, :, 2] += m * np.sin(rad) * hh_sat / 100.0 * 20.0 * intensity
        if sh_sat > 0.5:
            m = np.clip((mid - L) / (mid + 1e-6), 0, 1)
            rad = preset.get('split_shadow_hue', 0.0) / 360.0 * 2 * np.pi
            lab[:, :, 1] += m * np.cos(rad) * sh_sat / 100.0 * 20.0 * intensity
            lab[:, :, 2] += m * np.sin(rad) * sh_sat / 100.0 * 20.0 * intensity
        result = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- Clarity (local contrast on L channel) ---
    clar = preset.get('clarity', 0.0)
    if abs(clar) > 0.5:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        blurred = cv2.GaussianBlur(L, (0, 0), sigmaX=20)
        lab[:, :, 0] = np.clip(L + (L - blurred) * (clar / 100.0) * 0.6 * intensity, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- Vibrance & Saturation ---
    vib = preset.get('vibrance', 0.0)
    sat = preset.get('saturation', 0.0)
    if abs(vib) > 0.5 or abs(sat) > 0.5:
        hsv = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        Sc = hsv[:, :, 1]
        if abs(sat) > 0.5:
            Sc *= 1.0 + (sat / 100.0) * intensity
        if abs(vib) > 0.5:
            wt = 1.0 - Sc / 255.0
            skin = ((hsv[:, :, 0] >= 5) & (hsv[:, :, 0] <= 25) & (Sc > 30)).astype(np.float32)
            Sc += wt * (1.0 - skin * 0.7) * (vib / 100.0) * intensity * 80.0
        hsv[:, :, 1] = np.clip(Sc, 0, 255)
        result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)

    # --- Sharpening (luminance only) ---
    sharp = preset.get('sharpness', 0.0)
    if sharp > 1.0:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        sig = max(0.5, preset.get('sharpen_radius', 1.0))
        blurred = cv2.GaussianBlur(L, (0, 0), sig)
        lab[:, :, 0] = np.clip(L + (L - blurred) * (sharp / 100.0) * intensity * 1.5, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # --- Vignette ---
    vig = preset.get('vignette_amount', 0.0)
    if abs(vig) > 0.5:
        ht, wd = result.shape[:2]
        Y, X = np.ogrid[:ht, :wd]
        cx, cy = wd / 2.0, ht / 2.0
        md = np.sqrt(cx ** 2 + cy ** 2)
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) / md
        mp = preset.get('vignette_midpoint', 50.0) / 100.0
        ft = preset.get('vignette_feather', 50.0) / 100.0
        vm = np.clip((d - mp) / (ft + 0.01), 0, 1) ** 1.5
        amt = vig / 100.0 * intensity
        factor = 1.0 + amt * vm if amt > 0 else 1.0 + amt * vm
        result *= factor[:, :, np.newaxis]

    # --- Grain ---
    gr = preset.get('grain_amount', 0.0)
    if gr > 0.5:
        ht, wd = result.shape[:2]
        sz = max(1, int(preset.get('grain_size', 25.0) / 25.0 * 4))
        smh, smw = max(1, ht // sz), max(1, wd // sz)
        noise = np.random.normal(0, (gr / 100.0) * 25.0 * intensity, (smh, smw)).astype(np.float32)
        noise = cv2.resize(noise, (wd, ht), interpolation=cv2.INTER_LINEAR)
        result += noise[:, :, np.newaxis]

    # --- Tone curve (custom points) ---
    tc = preset.get('tone_curve')
    if tc and len(tc) >= 2:
        pts = np.array(tc, dtype=np.float64)
        lut = np.interp(np.arange(256), pts[:, 0], pts[:, 1]).astype(np.float32)
        ident = np.arange(256, dtype=np.float32)
        blut = np.clip(ident * (1 - intensity) + lut * intensity, 0, 255).astype(np.uint8)
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB)
        lab[:, :, 0] = blut[lab[:, :, 0]]
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR).astype(np.float32)

    return np.clip(result, 0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════
# REFERENCE IMAGE LEARNING (TIER B)
# ═══════════════════════════════════════════════════════════════

def compute_channel_stats(img_array: np.ndarray) -> dict:
    """Compute per-channel statistics for a single image."""
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

    lab = cv2.cvtColor(img_array, cv2.COLOR_BGR2LAB).astype(float)
    bgr = img_array.astype(float)
    hsv = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV).astype(float)
    stats = {}

    for i, name in enumerate(["b", "g", "r"]):
        ch = bgr[:, :, i]
        hist, _ = np.histogram(ch, bins=256, range=(0, 256))
        hist = hist.astype(float) / hist.sum()
        stats[f"hist_{name}"] = hist.tolist()
        stats[f"mean_{name}"] = float(np.mean(ch))
        stats[f"std_{name}"] = float(np.std(ch))

    for i, name in enumerate(["l", "a", "b_lab"]):
        ch = lab[:, :, i]
        hist, _ = np.histogram(ch, bins=256, range=(0, 256))
        hist = hist.astype(float) / hist.sum()
        stats[f"hist_{name}"] = hist.tolist()
        stats[f"mean_{name}"] = float(np.mean(ch))
        stats[f"std_{name}"] = float(np.std(ch))

    stats["mean_saturation"] = float(np.mean(hsv[:, :, 1]))
    stats["mean_value"] = float(np.mean(hsv[:, :, 2]))
    stats["std_saturation"] = float(np.std(hsv[:, :, 1]))

    L = lab[:, :, 0]
    stats["shadow_mean"] = float(np.mean(L[L < 85])) if np.any(L < 85) else 40.0
    stats["midtone_mean"] = float(np.mean(L[(L >= 85) & (L <= 170)])) if np.any((L >= 85) & (L <= 170)) else 128.0
    stats["highlight_mean"] = float(np.mean(L[L > 170])) if np.any(L > 170) else 200.0
    stats["wb_a"] = float(np.mean(lab[:, :, 1]))
    stats["wb_b"] = float(np.mean(lab[:, :, 2]))

    # Tone curve learning — capture the actual luminance distribution
    # Black point: what's the minimum L value that has significant data?
    l_hist, _ = np.histogram(L.flatten(), bins=256, range=(0, 256))
    l_hist_norm = l_hist.astype(float) / l_hist.sum()
    cum = 0.0
    black_point = 0
    for v in range(256):
        cum += l_hist_norm[v]
        if cum > 0.005:  # 0.5% threshold
            black_point = v
            break
    stats["black_point"] = black_point

    # White point
    cum = 0.0
    white_point = 255
    for v in range(255, -1, -1):
        cum += l_hist_norm[v]
        if cum > 0.005:
            white_point = v
            break
    stats["white_point"] = white_point

    # Percentile luminance values (for tone curve shape)
    flat_L = L.flatten()
    for pct in [5, 10, 25, 50, 75, 90, 95]:
        stats[f"l_p{pct}"] = float(np.percentile(flat_L, pct))

    # Shadow colour cast (average a/b in shadows)
    shadow_mask = L < 85
    if np.any(shadow_mask):
        stats["shadow_a"] = float(np.mean(lab[:, :, 1][shadow_mask]))
        stats["shadow_b"] = float(np.mean(lab[:, :, 2][shadow_mask]))

    # Highlight colour cast
    highlight_mask = L > 170
    if np.any(highlight_mask):
        stats["highlight_a"] = float(np.mean(lab[:, :, 1][highlight_mask]))
        stats["highlight_b"] = float(np.mean(lab[:, :, 2][highlight_mask]))

    return stats


def train_style_profile(reference_images: list[np.ndarray], preset_params: dict | None = None) -> dict:
    """
    Build a style profile. Two tiers:
    - Tier A (preset_params): Exact LR parameters stored directly
    - Tier B (reference_images): Statistical learning aggregated
    """
    if not reference_images and not preset_params:
        return {"error": "No reference images or preset provided"}

    log.info(f"Training style from {len(reference_images)} reference images"
             f"{' + preset baseline' if preset_params else ''}")

    profile = {"version": "2.0", "has_preset": preset_params is not None}

    if preset_params:
        profile["preset"] = preset_params

    if reference_images:
        all_stats = [compute_channel_stats(img) for img in reference_images]
        ref = {}
        for key in all_stats[0].keys():
            vals = [s[key] for s in all_stats if key in s]
            if isinstance(vals[0], list):
                ref[key] = np.mean(np.array(vals), axis=0).tolist()
            else:
                ref[key] = float(np.mean(vals))
        profile["reference"] = ref
        profile["num_reference_images"] = len(reference_images)

    return profile


# ═══════════════════════════════════════════════════════════════
# STYLE APPLICATION (COMBINED)
# ═══════════════════════════════════════════════════════════════

def histogram_match_channel(source: np.ndarray, target_hist: np.ndarray) -> np.ndarray:
    """Match source channel histogram to target distribution."""
    src_hist, _ = np.histogram(source.flatten(), bins=256, range=(0, 256))
    src_cdf = np.cumsum(src_hist).astype(float)
    src_cdf /= src_cdf[-1]
    tgt_cdf = np.cumsum(target_hist).astype(float)
    tgt_cdf /= tgt_cdf[-1]
    mapping = np.zeros(256, dtype=np.uint8)
    for v in range(256):
        mapping[v] = np.argmin(np.abs(src_cdf[v] - tgt_cdf))
    return mapping[source]


def compute_adaptive_adjustments(image_context: dict) -> dict:
    """
    Compute per-image adjustments based on Phase 0 analysis.
    Returns modifiers that scale preset/style parameters up or down.
    """
    chars = image_context.get("characteristics", {})
    scene = image_context.get("scene_type", "unknown")
    face_count = image_context.get("face_count", 0)
    quality = image_context.get("quality_details", {})

    adj = {
        "exposure_shift": 0.0,      # added to preset exposure (-1 to +1 range, maps to -100..+100)
        "contrast_mod": 1.0,        # multiplier on contrast adjustment
        "highlights_shift": 0.0,    # extra highlight recovery
        "shadows_shift": 0.0,       # extra shadow lift
        "warmth_shift": 0.0,        # extra warmth (LAB b offset)
        "saturation_mod": 1.0,      # multiplier on saturation
        "clarity_mod": 1.0,         # multiplier on clarity
        "sharpness_mod": 1.0,       # multiplier on sharpening
        "skin_protect": 0.4,        # skin protection strength (higher = more protection)
        "vignette_mod": 1.0,        # multiplier on vignette
    }

    if not chars:
        return adj

    exposure_bias = chars.get("exposure_bias", 0.0)
    is_backlit = chars.get("is_backlit", False)
    is_noisy = chars.get("is_noisy", False)
    is_low_contrast = chars.get("is_low_contrast", False)
    mean_brightness = chars.get("mean_brightness", 128)
    dynamic_range = chars.get("dynamic_range", 200)
    mean_saturation = chars.get("mean_saturation", 100)

    # ── Exposure correction ──
    # Underexposed images: push exposure harder
    if exposure_bias < -0.2:
        adj["exposure_shift"] = abs(exposure_bias) * 0.4  # lift underexposed
        adj["shadows_shift"] = abs(exposure_bias) * 0.3
    # Overexposed: pull back slightly
    elif exposure_bias > 0.25:
        adj["exposure_shift"] = -exposure_bias * 0.2
        adj["highlights_shift"] = -exposure_bias * 0.3

    # ── Backlit subjects ──
    if is_backlit:
        adj["exposure_shift"] += 0.15
        adj["shadows_shift"] += 0.25
        adj["highlights_shift"] -= 0.2  # recover blown highlights
        log.debug("Adaptive: backlit subject detected — lifting shadows, recovering highlights")

    # ── Low contrast / flat images ──
    if is_low_contrast:
        adj["contrast_mod"] = 1.3
        adj["clarity_mod"] = 1.2
    elif chars.get("is_high_contrast", False):
        adj["contrast_mod"] = 0.7

    # ── Noisy images ──
    if is_noisy:
        adj["sharpness_mod"] = 0.4   # reduce sharpening on noisy images
        adj["clarity_mod"] = 0.6     # reduce clarity too (amplifies noise)
        log.debug("Adaptive: noisy image — reducing sharpness and clarity")

    # ── Scene-specific adjustments ──
    if scene == "portrait" or face_count > 0:
        adj["skin_protect"] = 0.6   # stronger skin protection for portraits
        adj["clarity_mod"] *= 0.8   # softer clarity for portraits (flattering)
        adj["sharpness_mod"] *= 0.85
        if face_count >= 3:
            # Group shots: ensure everyone is visible
            adj["shadows_shift"] += 0.1

    elif scene == "landscape":
        adj["clarity_mod"] *= 1.3   # landscapes benefit from clarity
        adj["saturation_mod"] = 1.1
        adj["vignette_mod"] = 1.2

    elif scene in ("ceremony", "reception"):
        # Indoor events: often underexposed with mixed lighting
        if mean_brightness < 110:
            adj["exposure_shift"] += 0.1
            adj["shadows_shift"] += 0.15

    elif scene == "detail":
        adj["clarity_mod"] *= 1.2
        adj["sharpness_mod"] *= 1.2

    # ── Already saturated images: don't oversaturate ──
    if mean_saturation > 160:
        adj["saturation_mod"] *= 0.7
    elif mean_saturation < 50:
        adj["saturation_mod"] *= 1.2

    # ── Narrow dynamic range: be gentler with contrast ──
    if dynamic_range < 120:
        adj["contrast_mod"] *= 0.8
    elif dynamic_range > 220:
        adj["highlights_shift"] -= 0.1
        adj["shadows_shift"] += 0.1

    return adj


def apply_style(img_array: np.ndarray, style_profile: dict, intensity: float = 0.75,
                image_context: dict | None = None) -> np.ndarray:
    """
    Apply style to an image.
    - With preset: apply preset params with per-image adaptive adjustments
    - Without preset: apply basic adaptive adjustments only (exposure, contrast, etc.)
    - Reference histogram matching is DISABLED — produces poor results on CPU.
      Will be replaced by neural style transfer (GPU/Modal) in next phase.
    """
    if len(img_array.shape) == 2:
        img_array = cv2.cvtColor(img_array, cv2.COLOR_GRAY2BGR)

    image_context = image_context or {}
    adjustments = compute_adaptive_adjustments(image_context)

    version = style_profile.get("version", "1.0")

    if version == "2.0":
        result = img_array.copy()
        preset = style_profile.get("preset")
        if preset:
            result = apply_preset_adaptive(result, preset, adjustments, intensity=min(intensity + 0.15, 1.0))
            log.info("Applied adaptive preset")
        else:
            # No preset — apply basic adaptive adjustments only
            result = _apply_basic_adjustments(result, adjustments)
            log.info("Applied basic adaptive adjustments (no preset, no reference)")
        return result

    # v1.0 fallback — basic adjustments only
    return _apply_basic_adjustments(img_array, adjustments)


def _apply_basic_adjustments(img_array: np.ndarray, adj: dict) -> np.ndarray:
    """
    Apply basic per-image adaptive adjustments without any style reference.
    Handles exposure correction, contrast, and scene-specific tweaks.
    """
    result = img_array.copy().astype(np.float32)

    # Exposure shift
    exp_shift = adj.get("exposure_shift", 0.0)
    if abs(exp_shift) > 0.01:
        result *= (1.0 + exp_shift)

    # Shadow lift
    shadow_shift = adj.get("shadows_shift", 0.0)
    if shadow_shift > 0.01:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        shadow_mask = np.clip((85.0 - L) / 85.0, 0, 1)
        L += shadow_mask * shadow_shift * 80.0
        lab[:, :, 0] = np.clip(L, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # Highlight recovery
    hi_shift = adj.get("highlights_shift", 0.0)
    if hi_shift < -0.01:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        hi_mask = np.clip((L - 170.0) / 85.0, 0, 1)
        L += hi_mask * hi_shift * 80.0
        lab[:, :, 0] = np.clip(L, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    # Contrast
    contrast_mod = adj.get("contrast_mod", 1.0)
    if abs(contrast_mod - 1.0) > 0.01:
        lab = cv2.cvtColor(np.clip(result, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        mean_l = np.mean(L)
        L = mean_l + (L - mean_l) * contrast_mod
        lab[:, :, 0] = np.clip(L, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)

    return np.clip(result, 0, 255).astype(np.uint8)


def apply_preset_adaptive(img_array: np.ndarray, preset: dict, adj: dict,
                          intensity: float = 0.85) -> np.ndarray:
    """Apply preset parameters with per-image adaptive adjustments."""
    # Build a modified preset with adjustments applied
    adapted = dict(preset)

    # Exposure
    base_exp = adapted.get("exposure", 0.0)
    adapted["exposure"] = base_exp + adj["exposure_shift"] * 100.0

    # Contrast
    base_contrast = adapted.get("contrast", 0.0)
    adapted["contrast"] = base_contrast * adj["contrast_mod"]

    # Highlights
    base_hi = adapted.get("highlights", 0.0)
    adapted["highlights"] = base_hi + adj["highlights_shift"] * 100.0

    # Shadows
    base_sh = adapted.get("shadows", 0.0)
    adapted["shadows"] = base_sh + adj["shadows_shift"] * 100.0

    # Clarity
    base_clar = adapted.get("clarity", 0.0)
    adapted["clarity"] = base_clar * adj["clarity_mod"]

    # Saturation & vibrance
    base_sat = adapted.get("saturation", 0.0)
    adapted["saturation"] = base_sat * adj["saturation_mod"]
    base_vib = adapted.get("vibrance", 0.0)
    adapted["vibrance"] = base_vib * adj["saturation_mod"]

    # Sharpening
    base_sharp = adapted.get("sharpness", 0.0)
    adapted["sharpness"] = base_sharp * adj["sharpness_mod"]

    # Vignette
    base_vig = adapted.get("vignette_amount", 0.0)
    adapted["vignette_amount"] = base_vig * adj["vignette_mod"]

    return apply_preset_params(img_array, adapted, intensity=intensity)


def _apply_reference_style(img_array: np.ndarray, ref: dict, intensity: float,
                           adj: dict | None = None) -> np.ndarray:
    """
    Apply reference-learned style using multi-method approach with adaptive adjustments.
    """
    adj = adj or {}
    result = img_array.copy()

    # Skin protection — strength adapted per scene
    skin_strength = adj.get("skin_protect", 0.4)
    ycrcb = cv2.cvtColor(img_array, cv2.COLOR_BGR2YCrCb)
    skin = ((ycrcb[:, :, 1] >= 133) & (ycrcb[:, :, 1] <= 173) &
            (ycrcb[:, :, 2] >= 77) & (ycrcb[:, :, 2] <= 127)).astype(np.float32)
    skin = cv2.GaussianBlur(skin, (21, 21), 0)
    skin_prot = 1.0 - (skin * skin_strength)

    # ── 1. PRIMARY: LAB histogram matching ──
    # This is the most powerful method — matches the entire tonal distribution
    has_lab_hist = all(f"hist_{c}" in ref for c in ["l", "a", "b_lab"])
    if has_lab_hist:
        lab = cv2.cvtColor(img_array, cv2.COLOR_BGR2LAB)
        lab_matched = lab.copy()
        for i, ch in enumerate(["l", "a", "b_lab"]):
            target_hist = np.array(ref[f"hist_{ch}"])
            lab_matched[:, :, i] = histogram_match_channel(lab[:, :, i], target_hist)

        # Blend: strong on colour channels, moderate on luminance
        lab_float = lab.astype(np.float32)
        matched_float = lab_matched.astype(np.float32)

        # L channel — moderate blend to preserve image's own exposure character
        l_blend = intensity * 0.5
        lab_float[:, :, 0] = lab_float[:, :, 0] * (1 - l_blend) + matched_float[:, :, 0] * l_blend

        # a/b channels — strong blend for colour grading, with skin protection
        ab_blend = intensity * 0.8 * skin_prot
        lab_float[:, :, 1] = lab_float[:, :, 1] * (1 - ab_blend) + matched_float[:, :, 1] * ab_blend
        lab_float[:, :, 2] = lab_float[:, :, 2] * (1 - ab_blend) + matched_float[:, :, 2] * ab_blend

        result = cv2.cvtColor(np.clip(lab_float, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

    # ── 2. SUPPLEMENT: BGR histogram matching ──
    # Adds per-channel colour grading that LAB might miss
    has_bgr_hist = all(f"hist_{c}" in ref for c in ["b", "g", "r"])
    if has_bgr_hist:
        bgr_matched = result.copy()
        for i, ch in enumerate(["b", "g", "r"]):
            target_hist = np.array(ref[f"hist_{ch}"])
            bgr_matched[:, :, i] = histogram_match_channel(result[:, :, i], target_hist)

        # Lighter blend since LAB already did the heavy lifting
        bgr_blend = intensity * 0.35 * skin_prot
        result_f = result.astype(np.float32)
        matched_f = bgr_matched.astype(np.float32)
        for i in range(3):
            result_f[:, :, i] = result_f[:, :, i] * (1 - bgr_blend) + matched_f[:, :, i] * bgr_blend
        result = np.clip(result_f, 0, 255).astype(np.uint8)

    # ── 3. Tone curve from percentiles ──
    if "l_p5" in ref and "l_p95" in ref:
        lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
        L = lab[:, :, 0]
        flat_L = L.flatten().astype(np.float64)
        src_pts = [0.0]
        tgt_pts = [max(ref.get("black_point", 0), 0)]
        for pct in [5, 10, 25, 50, 75, 90, 95]:
            src_pts.append(float(np.percentile(flat_L, pct)))
            tgt_pts.append(ref.get(f"l_p{pct}", src_pts[-1]))
        src_pts.append(255.0)
        tgt_pts.append(min(ref.get("white_point", 255), 255))
        lut = np.interp(np.arange(256), src_pts, tgt_pts).astype(np.float32)
        ident = np.arange(256, dtype=np.float32)
        tc_blend = intensity * 0.6
        blended = np.clip(ident * (1 - tc_blend) + lut * tc_blend, 0, 255).astype(np.uint8)
        lab[:, :, 0] = blended[L]
        result = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # ── 4. Lifted blacks ──
    if "black_point" in ref and ref["black_point"] > 5:
        lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        bp = ref["black_point"]
        lift = bp * intensity * 0.9
        dark_mask = np.clip(1.0 - L / max(bp * 2.5, 1), 0, 1)
        L += dark_mask * lift
        lab[:, :, 0] = np.clip(L, 0, 255)
        result = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

    # ── 5. Shadow/highlight colour cast ──
    if "shadow_a" in ref and "shadow_b" in ref:
        lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB).astype(np.float32)
        L = lab[:, :, 0]
        shadow_mask = np.clip((85.0 - L) / 85.0, 0, 1)
        cur_sa = np.mean(lab[:, :, 1][L < 85]) if np.any(L < 85) else 128.0
        cur_sb = np.mean(lab[:, :, 2][L < 85]) if np.any(L < 85) else 128.0
        lab[:, :, 1] += shadow_mask * (ref["shadow_a"] - cur_sa) * intensity * 0.7
        lab[:, :, 2] += shadow_mask * (ref["shadow_b"] - cur_sb) * intensity * 0.7
        if "highlight_a" in ref and "highlight_b" in ref:
            hi_mask = np.clip((L - 170.0) / 85.0, 0, 1)
            cur_ha = np.mean(lab[:, :, 1][L > 170]) if np.any(L > 170) else 128.0
            cur_hb = np.mean(lab[:, :, 2][L > 170]) if np.any(L > 170) else 128.0
            lab[:, :, 1] += hi_mask * (ref["highlight_a"] - cur_ha) * intensity * 0.5
            lab[:, :, 2] += hi_mask * (ref["highlight_b"] - cur_hb) * intensity * 0.5
        result = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

    # ── 6. Saturation ──
    if "mean_saturation" in ref:
        hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(np.float32)
        cur_sat = max(np.mean(hsv[:, :, 1]), 1e-6)
        tgt_sat = ref["mean_saturation"]
        ratio = max(0.4, min(2.5, tgt_sat / cur_sat))
        hsv[:, :, 1] = hsv[:, :, 1] * (1.0 + (ratio - 1.0) * intensity * 0.8)
        result = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)

    return result


# ═══════════════════════════════════════════════════════════════
# CONVENIENCE
# ═══════════════════════════════════════════════════════════════

def load_image_from_bytes(image_bytes: bytes) -> Optional[np.ndarray]:
    """Decode image bytes to BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is not None:
        return img
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = pil_img.convert("RGB")
        return np.array(pil_img)[:, :, ::-1]
    except Exception:
        return None
