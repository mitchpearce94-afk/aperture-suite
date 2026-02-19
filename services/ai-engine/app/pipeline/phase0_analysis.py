"""
Phase 0 — Image Analysis

Extracts metadata and scores each image:
- EXIF extraction (camera, lens, ISO, aperture, shutter speed, focal length)
- Scene type classification (portrait, landscape, ceremony, reception, detail, group, candid)
- Quality scoring (exposure, focus/sharpness, noise, composition)
- Face detection + counting
- Duplicate/burst grouping by timestamp + visual similarity
"""
import io
import logging
import numpy as np
import cv2
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from typing import Optional
from datetime import datetime

log = logging.getLogger(__name__)

# RAW file extensions supported by rawpy/libraw
RAW_EXTENSIONS = {
    '.dng', '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
    '.orf', '.rw2', '.pef', '.raf', '.raw', '.3fr', '.mef', '.mrw',
    '.x3f', '.srw', '.erf', '.kdc', '.dcr', '.rwl', '.iiq',
}


def is_raw_file(filename: str) -> bool:
    """Check if a filename has a RAW extension."""
    import os
    ext = os.path.splitext(filename.lower())[1]
    return ext in RAW_EXTENSIONS


def decode_raw(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Decode a RAW image file to full-resolution BGR numpy array using rawpy.

    Returns None if decoding fails.
    """
    try:
        import rawpy
        import tempfile
        import os

        # rawpy needs a file path — write to temp file
        with tempfile.NamedTemporaryFile(suffix='.dng', delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            with rawpy.imread(tmp_path) as raw:
                # Process with reasonable defaults for photography
                rgb = raw.postprocess(
                    use_camera_wb=True,       # Use camera white balance
                    half_size=False,           # Full resolution
                    no_auto_bright=False,      # Auto brightness
                    output_bps=8,              # 8-bit output
                    bright=1.0,                # Normal brightness
                    demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
                )
                # Convert RGB to BGR for OpenCV
                bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                log.info(f"RAW decoded: {bgr.shape[1]}x{bgr.shape[0]}")
                return bgr
        finally:
            os.unlink(tmp_path)

    except ImportError:
        log.error("rawpy not installed — cannot decode RAW files")
        return None
    except Exception as e:
        log.error(f"RAW decode failed: {e}")
        return None


def generate_web_preview(img_array: np.ndarray, max_dimension: int = 2048, quality: int = 92) -> bytes:
    """
    Generate a JPEG preview from a BGR numpy array.
    Used to create web-viewable previews for RAW files.
    """
    h, w = img_array.shape[:2]
    if max(h, w) > max_dimension:
        scale = max_dimension / max(h, w)
        img_array = cv2.resize(img_array, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    success, buffer = cv2.imencode(".jpg", img_array, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise ValueError("Failed to encode JPEG preview")
    return buffer.tobytes()


# ── EXIF Extraction ──────────────────────────────────────────

def extract_exif(image_bytes: bytes) -> dict:
    """Extract useful EXIF data from image bytes."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        raw_exif = img.getexif()
        if not raw_exif:
            return {}

        exif = {}
        for tag_id, value in raw_exif.items():
            tag = TAGS.get(tag_id, str(tag_id))
            # Only keep useful, serialisable fields
            if tag in (
                "Make", "Model", "LensModel", "LensMake",
                "ISOSpeedRatings", "ExposureTime", "FNumber", "FocalLength",
                "DateTimeOriginal", "DateTimeDigitized", "DateTime",
                "ImageWidth", "ImageLength", "Orientation",
                "Flash", "WhiteBalance", "ExposureProgram", "MeteringMode",
                "ExposureBiasValue", "BrightnessValue",
            ):
                # Convert rationals to float
                if hasattr(value, "numerator"):
                    value = float(value)
                exif[tag] = value

        return exif
    except Exception as e:
        log.warning(f"EXIF extraction failed: {e}")
        return {}


# ── Scene Type Detection ─────────────────────────────────────

def detect_scene_type(img_array: np.ndarray, face_count: int) -> str:
    """
    Classify scene type based on image characteristics and face count.

    Categories: portrait, group, landscape, detail, ceremony, reception, candid
    """
    h, w = img_array.shape[:2]
    aspect = w / h

    # Convert to grayscale for analysis
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array

    # Compute image properties
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.sum(edges > 0) / edges.size

    # Colour analysis — check for warm tones (reception), greens (outdoor), etc.
    if len(img_array.shape) == 3:
        hsv = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV)
        avg_saturation = np.mean(hsv[:, :, 1])
        avg_brightness = np.mean(hsv[:, :, 2])

        # Green channel ratio (outdoor/landscape indicator)
        green_ratio = np.mean(img_array[:, :, 1]) / (np.mean(img_array) + 1e-6)
    else:
        avg_saturation = 0
        avg_brightness = np.mean(gray)
        green_ratio = 1.0

    # Face-based classification
    if face_count == 0:
        if aspect > 1.5 and green_ratio > 1.05:
            return "landscape"
        if edge_density > 0.15:
            return "detail"
        if avg_brightness < 100 and avg_saturation > 60:
            return "reception"
        return "landscape"

    if face_count == 1:
        # Check if face takes up significant portion (portrait vs candid)
        return "portrait"

    if face_count == 2:
        return "portrait"

    if face_count >= 3 and face_count <= 6:
        return "group"

    if face_count > 6:
        # Large group likely ceremony or reception
        if avg_brightness < 120:
            return "reception"
        return "ceremony"

    return "candid"


# ── Quality Scoring ──────────────────────────────────────────

def score_quality(img_array: np.ndarray) -> dict:
    """
    Score image quality on multiple dimensions (0-100 each).

    Returns:
        {
            "overall": float,
            "exposure": float,
            "sharpness": float,
            "noise": float,
            "composition": float,
        }
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array
    h, w = gray.shape

    # ── Exposure score (check histogram spread and mean brightness)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    hist_norm = hist / hist.sum()

    mean_brightness = np.mean(gray)
    # Ideal range: 90-170
    if 90 <= mean_brightness <= 170:
        exposure_score = 90 + 10 * (1 - abs(mean_brightness - 128) / 42)
    elif mean_brightness < 90:
        exposure_score = max(20, 90 * (mean_brightness / 90))
    else:
        exposure_score = max(20, 90 * ((255 - mean_brightness) / 85))

    # Penalise heavy clipping
    clipped_dark = np.sum(hist_norm[:5])
    clipped_bright = np.sum(hist_norm[250:])
    exposure_score -= min(30, (clipped_dark + clipped_bright) * 200)
    exposure_score = max(0, min(100, exposure_score))

    # ── Sharpness (Laplacian variance — higher = sharper)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness_raw = laplacian.var()
    # Normalise: <50 is very soft, >500 is razor sharp
    sharpness_score = min(100, max(0, (sharpness_raw - 10) / 5))

    # ── Noise estimation (using small patch variance)
    # Sample 10 random 32x32 patches and measure micro-variance
    patch_size = 32
    noise_estimates = []
    rng = np.random.RandomState(42)
    for _ in range(10):
        y = rng.randint(0, max(1, h - patch_size))
        x = rng.randint(0, max(1, w - patch_size))
        patch = gray[y:y+patch_size, x:x+patch_size].astype(float)
        # High-pass filter to isolate noise
        blurred = cv2.GaussianBlur(patch, (5, 5), 0)
        diff = np.abs(patch - blurred)
        noise_estimates.append(np.mean(diff))

    avg_noise = np.mean(noise_estimates)
    # Lower noise = better: <3 is clean, >15 is very noisy
    noise_score = max(0, min(100, 100 - (avg_noise - 2) * 7))

    # ── Composition (rule of thirds interest points)
    # Check if high-contrast regions align with power points
    edges = cv2.Canny(gray, 80, 200)
    third_h, third_w = h // 3, w // 3

    # Power zones (intersections of thirds)
    zones = [
        edges[third_h-20:third_h+20, third_w-20:third_w+20],
        edges[third_h-20:third_h+20, 2*third_w-20:2*third_w+20],
        edges[2*third_h-20:2*third_h+20, third_w-20:third_w+20],
        edges[2*third_h-20:2*third_h+20, 2*third_w-20:2*third_w+20],
    ]

    zone_activity = sum(np.sum(z > 0) for z in zones if z.size > 0)
    total_edges = max(1, np.sum(edges > 0))
    thirds_ratio = zone_activity / total_edges

    composition_score = min(100, max(40, 50 + thirds_ratio * 500))

    # ── Overall weighted average
    overall = (
        exposure_score * 0.30
        + sharpness_score * 0.30
        + noise_score * 0.20
        + composition_score * 0.20
    )

    return {
        "overall": round(overall, 1),
        "exposure": round(exposure_score, 1),
        "sharpness": round(sharpness_score, 1),
        "noise": round(noise_score, 1),
        "composition": round(composition_score, 1),
    }


# ── Face Detection ───────────────────────────────────────────

# Load face cascade once
_face_cascade = None

def _get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade


def detect_faces(img_array: np.ndarray) -> list[dict]:
    """
    Detect faces and return bounding boxes.

    Returns list of:
        {"bbox": [x, y, w, h], "eyes_open": True}
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array

    # Resize for speed if image is very large
    h, w = gray.shape
    scale = 1.0
    if max(h, w) > 1500:
        scale = 1500 / max(h, w)
        gray = cv2.resize(gray, None, fx=scale, fy=scale)

    cascade = _get_face_cascade()
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
    )

    results = []
    for (x, y, fw, fh) in faces:
        # Scale back to original coordinates
        results.append({
            "bbox": [
                int(x / scale),
                int(y / scale),
                int(fw / scale),
                int(fh / scale),
            ],
            "eyes_open": True,  # Placeholder — could add eye cascade
        })

    return results


# ── Duplicate/Burst Grouping ─────────────────────────────────

def compute_image_hash(img_array: np.ndarray) -> str:
    """Compute a perceptual hash (pHash) for duplicate detection."""
    # Resize to 32x32, greyscale
    resized = cv2.resize(img_array, (32, 32))
    if len(resized.shape) == 3:
        resized = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # DCT-based hash
    dct = cv2.dct(np.float32(resized))
    dct_low = dct[:8, :8]
    median = np.median(dct_low)
    bits = (dct_low > median).flatten()
    return "".join(str(int(b)) for b in bits)


def hamming_distance(hash1: str, hash2: str) -> int:
    """Count differing bits between two hashes."""
    return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))


def group_duplicates(photos: list[dict], threshold: int = 10) -> dict[str, list[str]]:
    """
    Group photos by visual similarity using perceptual hashing.

    Returns: {group_id: [photo_id, ...]}
    """
    if not photos:
        return {}

    groups: dict[str, list[str]] = {}
    group_leaders: list[tuple[str, str]] = []  # (group_id, hash)

    for photo in photos:
        p_hash = photo.get("_phash", "")
        p_id = photo["id"]

        if not p_hash:
            # Each unhashed photo is its own group
            groups[p_id] = [p_id]
            continue

        matched = False
        for leader_id, leader_hash in group_leaders:
            if hamming_distance(p_hash, leader_hash) < threshold:
                groups[leader_id].append(p_id)
                matched = True
                break

        if not matched:
            groups[p_id] = [p_id]
            group_leaders.append((p_id, p_hash))

    return groups


# ── Main Phase 0 Entry Point ─────────────────────────────────

def analyse_image(image_bytes: bytes, filename: str = "") -> dict:
    """
    Run full Phase 0 analysis on a single image.

    Args:
        image_bytes: Raw file bytes
        filename: Original filename (used to detect RAW format)

    Returns:
        {
            "exif_data": {...},
            "scene_type": str,
            "quality_score": float,
            "quality_details": {...},
            "face_data": [...],
            "face_count": int,
            "phash": str,
            "width": int,
            "height": int,
            "is_raw": bool,
            "web_preview_bytes": bytes | None,  # JPEG preview for RAW files
        }
    """
    is_raw = is_raw_file(filename) if filename else False
    web_preview_bytes = None

    # Decode image
    img = None
    nparr = np.frombuffer(image_bytes, np.uint8)

    if not is_raw:
        # Try standard decode first (JPEG, PNG, TIFF, etc.)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        # Either it's a known RAW or cv2 couldn't decode it — try rawpy
        img = decode_raw(image_bytes)
        if img is not None:
            is_raw = True
        else:
            # Last resort: PIL (may only get thumbnail for some formats)
            try:
                pil_img = Image.open(io.BytesIO(image_bytes))
                pil_img = pil_img.convert("RGB")
                img = np.array(pil_img)[:, :, ::-1]  # RGB → BGR for OpenCV
                log.warning(f"Fell back to PIL for {filename} — image may be low resolution ({img.shape[1]}x{img.shape[0]})")
            except Exception:
                log.error(f"Failed to decode image: {filename}")
                return {"error": "Failed to decode image"}

    h, w = img.shape[:2]

    # For RAW files, generate a web-viewable JPEG preview
    if is_raw:
        try:
            web_preview_bytes = generate_web_preview(img, max_dimension=2048, quality=92)
            log.info(f"Generated web preview for RAW {filename}: {len(web_preview_bytes)} bytes")
        except Exception as e:
            log.error(f"Failed to generate web preview for {filename}: {e}")

    # Resize for analysis to prevent OOM on memory-constrained containers
    # Analysis (face detection, scene, quality) doesn't need full resolution
    MAX_ANALYSIS_DIM = 1600
    if max(h, w) > MAX_ANALYSIS_DIM:
        scale = MAX_ANALYSIS_DIM / max(h, w)
        analysis_img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        analysis_img = img
    # Free full-res immediately
    del img

    # Run all analyses on the resized image
    exif = extract_exif(image_bytes)
    faces = detect_faces(analysis_img)
    face_count = len(faces)
    scene = detect_scene_type(analysis_img, face_count)
    quality = score_quality(analysis_img)
    phash = compute_image_hash(analysis_img)

    # Image characteristics for adaptive editing
    characteristics = _compute_image_characteristics(analysis_img)

    return {
        "exif_data": exif,
        "scene_type": scene,
        "quality_score": quality["overall"],
        "quality_details": quality,
        "face_data": faces,
        "face_count": face_count,
        "phash": phash,
        "width": w,   # Original dimensions
        "height": h,
        "characteristics": characteristics,
        "is_raw": is_raw,
        "web_preview_bytes": web_preview_bytes,
    }


def _compute_image_characteristics(img: np.ndarray) -> dict:
    """Compute image characteristics used by adaptive preset system."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    L = lab[:, :, 0]
    h_img, w_img = img.shape[:2]

    # Brightness
    mean_brightness = float(np.mean(L))
    # How underexposed (0=correct, negative=under, positive=over)
    exposure_bias = (mean_brightness - 128.0) / 128.0  # -1 to +1

    # Contrast (std dev of luminance)
    contrast = float(np.std(L))
    is_low_contrast = contrast < 35
    is_high_contrast = contrast > 65

    # Clipping
    dark_clip = float(np.mean(L < 10))    # % of pixels near black
    bright_clip = float(np.mean(L > 245))  # % of pixels near white

    # Backlit detection — bright background, dark foreground
    center_h, center_w = h_img // 4, w_img // 4
    center_L = L[center_h:3*center_h, center_w:3*center_w]
    edge_L = np.mean([
        np.mean(L[:center_h, :]),           # top
        np.mean(L[3*center_h:, :]),         # bottom
        np.mean(L[:, :center_w]),           # left
        np.mean(L[:, 3*center_w:]),         # right
    ])
    center_mean = float(np.mean(center_L))
    is_backlit = edge_L > center_mean + 30

    # Colour temperature estimate from white balance
    # LAB b channel: negative=blue/cool, positive=yellow/warm
    wb_warmth = float(np.mean(lab[:, :, 2]))  # >128 = warm, <128 = cool
    wb_tint = float(np.mean(lab[:, :, 1]))    # >128 = green-magenta

    # Saturation
    mean_saturation = float(np.mean(hsv[:, :, 1]))
    is_desaturated = mean_saturation < 40
    is_oversaturated = mean_saturation > 180

    # Noise estimate (quick)
    noise_sigma = float(np.mean(np.abs(
        gray.astype(float) - cv2.GaussianBlur(gray, (5, 5), 0).astype(float)
    )))
    is_noisy = noise_sigma > 8

    # Dynamic range
    p2 = float(np.percentile(L, 2))
    p98 = float(np.percentile(L, 98))
    dynamic_range = p98 - p2

    return {
        "mean_brightness": mean_brightness,
        "exposure_bias": round(exposure_bias, 3),
        "contrast": contrast,
        "is_low_contrast": is_low_contrast,
        "is_high_contrast": is_high_contrast,
        "dark_clip_pct": round(dark_clip, 4),
        "bright_clip_pct": round(bright_clip, 4),
        "is_backlit": is_backlit,
        "wb_warmth": wb_warmth,
        "wb_tint": wb_tint,
        "mean_saturation": mean_saturation,
        "is_desaturated": is_desaturated,
        "is_noisy": is_noisy,
        "noise_sigma": round(noise_sigma, 2),
        "dynamic_range": round(dynamic_range, 1),
        "l_p2": round(p2, 1),
        "l_p98": round(p98, 1),
    }
