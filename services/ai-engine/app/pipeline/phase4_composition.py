"""
Phase 4 — Composition

- Horizon detection + straightening
- Crop optimisation (rule-of-thirds alignment)
- Both run on CPU using OpenCV
"""
import logging
import math
import numpy as np
import cv2

log = logging.getLogger(__name__)


# ── Horizon Detection & Straightening ────────────────────────

def detect_horizon_angle(img_array: np.ndarray) -> float:
    """
    Detect the horizon angle using Hough line detection.

    Returns: angle in degrees (positive = clockwise tilt)
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array

    # Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)

    # Hough lines
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=min(gray.shape) // 4,
        maxLineGap=20,
    )

    if lines is None or len(lines) == 0:
        return 0.0

    # Filter for roughly horizontal lines (within ±15°)
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        dx = x2 - x1
        dy = y2 - y1
        if abs(dx) < 1:
            continue
        angle = math.degrees(math.atan2(dy, dx))
        if abs(angle) < 15:
            length = math.sqrt(dx**2 + dy**2)
            angles.append((angle, length))

    if not angles:
        return 0.0

    # Weighted average by line length
    total_weight = sum(w for _, w in angles)
    weighted_angle = sum(a * w for a, w in angles) / total_weight

    return weighted_angle


def straighten_image(img_array: np.ndarray, angle: float, max_angle: float = 3.0) -> np.ndarray:
    """
    Rotate image to correct horizon tilt.

    Only corrects if angle is between min_angle and max_angle degrees.
    Conservative thresholds to avoid over-rotating intentionally tilted shots
    or false-positive horizon detections from landscape features.
    """
    min_angle = 1.0  # Don't bother correcting tiny tilts — likely noise

    if abs(angle) < min_angle:
        return img_array

    if abs(angle) > max_angle:
        log.info(f"Horizon angle {angle:.1f}° exceeds max {max_angle}° — skipping (likely intentional tilt)")
        return img_array

    h, w = img_array.shape[:2]
    center = (w // 2, h // 2)

    M = cv2.getRotationMatrix2D(center, angle, 1.0)

    # Calculate new bounding box to avoid black borders
    cos = abs(M[0, 0])
    sin = abs(M[0, 1])
    new_w = int(h * sin + w * cos)
    new_h = int(h * cos + w * sin)
    M[0, 2] += (new_w - w) / 2
    M[1, 2] += (new_h - h) / 2

    rotated = cv2.warpAffine(img_array, M, (new_w, new_h), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))

    # Crop to the largest inscribed rectangle (no black borders)
    # For small angles, the inscribed rect is very close to the original size
    import math
    rad = abs(math.radians(angle))
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)

    # Width and height of the largest axis-aligned rectangle inscribed in the rotated image
    if w <= 0 or h <= 0:
        return rotated
    wr = w * cos_a - h * sin_a
    hr = h * cos_a - w * sin_a

    # If the inscribed rect is invalid (very large angles), just center crop
    if wr <= 0 or hr <= 0:
        crop_margin_x = (new_w - w) // 2
        crop_margin_y = (new_h - h) // 2
        if crop_margin_x > 0 or crop_margin_y > 0:
            rotated = rotated[crop_margin_y:new_h - crop_margin_y, crop_margin_x:new_w - crop_margin_x]
        return rotated

    # Center crop to inscribed rectangle
    cx, cy = new_w // 2, new_h // 2
    x1 = max(0, int(cx - wr / 2))
    y1 = max(0, int(cy - hr / 2))
    x2 = min(new_w, int(cx + wr / 2))
    y2 = min(new_h, int(cy + hr / 2))

    return rotated[y1:y2, x1:x2].copy()


# ── Crop Optimisation ────────────────────────────────────────

def compute_interest_map(img_array: np.ndarray) -> np.ndarray:
    """
    Compute a saliency/interest map for crop optimisation.
    Combines edge density, face positions, and colour contrast.
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array

    # Saliency via spectral residual (fast approximation)
    # Use edge density as proxy
    edges = cv2.Canny(gray, 50, 150)
    blurred = cv2.GaussianBlur(edges.astype(float), (31, 31), 0)

    # Normalise
    if blurred.max() > 0:
        blurred /= blurred.max()

    return blurred


def suggest_crop(img_array: np.ndarray, target_aspect: float = 0.0, face_boxes: list[dict] = None) -> tuple[int, int, int, int]:
    """
    Suggest an optimised crop that aligns subjects with rule-of-thirds power points.

    Args:
        img_array: BGR image
        target_aspect: Desired aspect ratio (w/h). 0 = keep original
        face_boxes: Optional face detection results from Phase 0

    Returns:
        (x, y, w, h) crop rectangle
    """
    h, w = img_array.shape[:2]
    current_aspect = w / h

    if target_aspect == 0:
        target_aspect = current_aspect

    # Compute interest map
    interest = compute_interest_map(img_array)

    # If we have faces, add strong weight to face regions
    if face_boxes:
        for face in face_boxes:
            fx, fy, fw, fh = face.get("bbox", [0, 0, 0, 0])
            # Expand face region slightly
            margin = int(max(fw, fh) * 0.3)
            fy_s = max(0, fy - margin)
            fy_e = min(h, fy + fh + margin)
            fx_s = max(0, fx - margin)
            fx_e = min(w, fx + fw + margin)
            interest[fy_s:fy_e, fx_s:fx_e] = np.maximum(
                interest[fy_s:fy_e, fx_s:fx_e], 0.8
            )

    # Find the crop window that maximises interest overlap
    # Try different positions with the target aspect ratio
    best_score = -1
    best_crop = (0, 0, w, h)

    # Calculate crop dimensions maintaining aspect ratio
    crop_w = w
    crop_h = int(w / target_aspect)
    if crop_h > h:
        crop_h = h
        crop_w = int(h * target_aspect)

    # Maximum trimming: 10% per side
    max_trim = 0.1

    # Only crop if needed (aspect ratio change or composition improvement)
    step = max(1, min(crop_w, crop_h) // 20)

    for y in range(0, max(1, h - crop_h + 1), step):
        for x in range(0, max(1, w - crop_w + 1), step):
            if x + crop_w > w or y + crop_h > h:
                continue

            # Skip crops that trim too much
            if x > w * max_trim or y > h * max_trim:
                continue
            if (w - (x + crop_w)) > w * max_trim or (h - (y + crop_h)) > h * max_trim:
                continue

            region = interest[y:y+crop_h, x:x+crop_w]
            score = np.mean(region)

            # Bonus for centering subjects on thirds
            third_y = crop_h // 3
            third_x = crop_w // 3
            thirds_region = region[third_y:2*third_y, third_x:2*third_x]
            thirds_score = np.mean(thirds_region) if thirds_region.size > 0 else 0

            total_score = score * 0.6 + thirds_score * 0.4

            if total_score > best_score:
                best_score = total_score
                best_crop = (x, y, crop_w, crop_h)

    return best_crop


def apply_crop(img_array: np.ndarray, crop: tuple[int, int, int, int]) -> np.ndarray:
    """Apply a crop rectangle to an image."""
    x, y, w, h = crop
    return img_array[y:y+h, x:x+w].copy()


# ── Main Phase 4 Entry Point ─────────────────────────────────

def fix_composition(img_array: np.ndarray, face_boxes: list[dict] = None, auto_crop: bool = True) -> tuple[np.ndarray, dict]:
    """
    Run Phase 4 composition fixes on a single image.

    Returns:
        (processed_image, metadata_dict)
    """
    metadata = {
        "horizon_angle": 0.0,
        "straightened": False,
        "cropped": False,
        "crop_rect": None,
    }

    # 1. Horizon straightening
    angle = detect_horizon_angle(img_array)
    metadata["horizon_angle"] = round(angle, 2)

    if abs(angle) >= 1.0:
        img_array = straighten_image(img_array, angle)
        metadata["straightened"] = abs(angle) >= 1.0 and abs(angle) <= 3.0

    # 2. Crop optimisation
    if auto_crop:
        crop = suggest_crop(img_array, face_boxes=face_boxes)
        x, y, cw, ch = crop
        h, w = img_array.shape[:2]

        # Only apply if crop is meaningful (trims more than 1% but less than 15%)
        trim_ratio = 1 - (cw * ch) / (w * h)
        if 0.01 < trim_ratio < 0.15:
            img_array = apply_crop(img_array, crop)
            metadata["cropped"] = True
            metadata["crop_rect"] = [x, y, cw, ch]

    return img_array, metadata
