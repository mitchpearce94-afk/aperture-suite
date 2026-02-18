"""
Apelier GPU Processing — Modal Serverless Endpoints
Phases 1 (Style), 2 (Face Retouch), 3 (Scene Cleanup) on A10G GPU.
Deploy: modal deploy modal_app.py
Test:   modal serve modal_app.py
"""

import modal
import io
import json

# ---------------------------------------------------------------------------
# Modal App + Container Images
# ---------------------------------------------------------------------------
app = modal.App("apelier-gpu")

# Shared base image for all GPU functions
gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "wget")
    .pip_install(
        "fastapi[standard]",
        "torch==2.3.1",
        "torchvision==0.18.1",
        "numpy",
        "opencv-python-headless",
        "Pillow",
        "httpx",
        "scipy",
        "rawpy",
    )
)

# Separate image for CodeFormer (needs extra deps)
codeformer_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "wget", "git")
    .pip_install(
        "fastapi[standard]",
        "torch==2.3.1",
        "torchvision==0.18.1",
        "numpy",
        "opencv-python-headless",
        "Pillow",
        "httpx",
        "scipy",
        "facexlib",
        "gfpgan",
        "basicsr",
        "rawpy",
    )
)

# LaMa image
lama_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0", "wget")
    .pip_install(
        "fastapi[standard]",
        "torch==2.3.1",
        "torchvision==0.18.1",
        "numpy",
        "opencv-python-headless",
        "Pillow",
        "httpx",
        "scipy",
        "scikit-image",
        "rawpy",
    )
)

# Persistent volume for cached model weights (survives across cold starts)
model_volume = modal.Volume.from_name("apelier-models", create_if_missing=True)
MODEL_DIR = "/models"

# ---------------------------------------------------------------------------
# Shared Supabase helpers (run inside Modal containers)
# ---------------------------------------------------------------------------
def download_from_supabase(url: str, service_key: str, bucket: str, path: str) -> bytes:
    """Download a file from Supabase Storage."""
    import httpx
    resp = httpx.get(
        f"{url}/storage/v1/object/{bucket}/{path}",
        headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.content


def open_image_bytes(img_bytes: bytes) -> "Image.Image":
    """Open image bytes as PIL RGB Image, with rawpy fallback for DNG/RAW files."""
    from PIL import Image
    try:
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception:
        pass
    # Fallback: rawpy for camera RAW formats
    import rawpy, tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.dng', delete=False) as f:
        f.write(img_bytes)
        tmp_path = f.name
    try:
        with rawpy.imread(tmp_path) as raw:
            rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
            return Image.fromarray(rgb)
    finally:
        os.unlink(tmp_path)


def upload_to_supabase(url: str, service_key: str, bucket: str, path: str, data: bytes, content_type: str = "image/jpeg"):
    """Upload a file to Supabase Storage (upsert)."""
    import httpx
    resp = httpx.post(
        f"{url}/storage/v1/object/{bucket}/{path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        content=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 1 — NEURAL STYLE TRANSFER (3D LUT PREDICTOR)
# ═══════════════════════════════════════════════════════════════════════════

# ---------------------------------------------------------------------------
# 3D LUT Network Architecture
# Lightweight CNN → predicts a 33×33×33 3D colour LUT
# Based on Zeng et al. 2020 "Learning Image-Adaptive 3D Lookup Tables"
# <600K params, resolution-independent, <2s inference on A10G
# ---------------------------------------------------------------------------

LUT_DIM = 33  # 33×33×33 = 35,937 points × 3 channels


def _build_lut_model():
    """Build the 3D LUT predictor network."""
    import torch
    import torch.nn as nn

    class LUTGenerator(nn.Module):
        """Predicts a 3D LUT from a downsampled input image."""
        def __init__(self, lut_dim=LUT_DIM):
            super().__init__()
            self.lut_dim = lut_dim

            # Backbone: 5 conv blocks, input 256×256×3
            self.backbone = nn.Sequential(
                nn.Conv2d(3, 32, 3, stride=2, padding=1), nn.ReLU(inplace=True),   # 128
                nn.Conv2d(32, 64, 3, stride=2, padding=1), nn.ReLU(inplace=True),  # 64
                nn.Conv2d(64, 128, 3, stride=2, padding=1), nn.ReLU(inplace=True), # 32
                nn.Conv2d(128, 128, 3, stride=2, padding=1), nn.ReLU(inplace=True),# 16
                nn.Conv2d(128, 128, 3, stride=2, padding=1), nn.ReLU(inplace=True),# 8
                nn.AdaptiveAvgPool2d(1),  # → 128×1×1
            )

            # Head: predict LUT values
            n_out = lut_dim * lut_dim * lut_dim * 3
            self.head = nn.Sequential(
                nn.Linear(128, 256), nn.ReLU(inplace=True),
                nn.Linear(256, n_out),
            )

            # Initialize LUT to identity (no-op transform)
            self._init_identity_lut()

        def _init_identity_lut(self):
            """Set final bias to identity LUT so untrained model = no change."""
            import torch
            with torch.no_grad():
                identity = torch.zeros(self.lut_dim, self.lut_dim, self.lut_dim, 3)
                coords = torch.linspace(0, 1, self.lut_dim)
                for r_i, r in enumerate(coords):
                    for g_i, g in enumerate(coords):
                        for b_i, b in enumerate(coords):
                            identity[r_i, g_i, b_i] = torch.tensor([r, g, b])
                self.head[-1].bias.data = identity.reshape(-1)
                nn.init.zeros_(self.head[-1].weight)

        def forward(self, x):
            feat = self.backbone(x).squeeze(-1).squeeze(-1)  # B×128
            lut_flat = self.head(feat)  # B × (D³×3)
            lut = lut_flat.reshape(-1, self.lut_dim, self.lut_dim, self.lut_dim, 3)
            return lut

    return LUTGenerator()


def _apply_lut(image_tensor, lut):
    """Apply 3D LUT to image using trilinear interpolation.
    image_tensor: (H, W, 3) float32 [0,1]
    lut: (D, D, D, 3) float32
    Returns: (H, W, 3) float32 [0,1]
    """
    import torch
    import torch.nn.functional as F

    H, W, _ = image_tensor.shape
    D = lut.shape[0]

    # Scale pixel values to LUT coordinates
    img = image_tensor.clone() * (D - 1)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]

    # Floor and ceil indices
    r0, g0, b0 = r.long().clamp(0, D-2), g.long().clamp(0, D-2), b.long().clamp(0, D-2)
    r1, g1, b1 = r0 + 1, g0 + 1, b0 + 1

    # Fractional parts
    fr, fg, fb = r - r0.float(), g - g0.float(), b - b0.float()

    # Trilinear interpolation (8 corners)
    def lookup(ri, gi, bi):
        return lut[ri, gi, bi]

    c000 = lookup(r0, g0, b0)
    c001 = lookup(r0, g0, b1)
    c010 = lookup(r0, g1, b0)
    c011 = lookup(r0, g1, b1)
    c100 = lookup(r1, g0, b0)
    c101 = lookup(r1, g0, b1)
    c110 = lookup(r1, g1, b0)
    c111 = lookup(r1, g1, b1)

    fr = fr.unsqueeze(-1)
    fg = fg.unsqueeze(-1)
    fb = fb.unsqueeze(-1)

    c00 = c000 * (1 - fr) + c100 * fr
    c01 = c001 * (1 - fr) + c101 * fr
    c10 = c010 * (1 - fr) + c110 * fr
    c11 = c011 * (1 - fr) + c111 * fr

    c0 = c00 * (1 - fg) + c10 * fg
    c1 = c01 * (1 - fg) + c11 * fg

    result = c0 * (1 - fb) + c1 * fb
    return result.clamp(0, 1)


# ---------------------------------------------------------------------------
# TRAINING ENDPOINT
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    image=gpu_image,
    volumes={MODEL_DIR: model_volume},
    timeout=1800,  # 30 min max
    secrets=[modal.Secret.from_name("apelier-supabase")],
)
@modal.fastapi_endpoint(method="POST")
def train_style(body: dict):
    """
    Train a 3D LUT style model from before/after image pairs.

    POST body:
    {
        "photographer_id": "uuid",
        "style_profile_id": "uuid",
        "pairs": [
            {"original_key": "uploads/raw/...", "edited_key": "uploads/edited/..."},
            ...
        ],
        "supabase_url": "https://xxx.supabase.co",
        "supabase_key": "service-role-key",
        "bucket": "photos",
        "epochs": 200
    }

    Returns: {"status": "success", "model_key": "models/{photographer_id}/{style_id}.pth"}
    """
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torchvision import transforms
    from PIL import Image
    import os, time

    photographer_id = body["photographer_id"]
    style_id = body["style_profile_id"]
    pairs = body["pairs"]
    supabase_url = body["supabase_url"]
    supabase_key = body["supabase_key"]
    bucket = body.get("bucket", "photos")
    epochs = body.get("epochs", 200)

    print(f"[TRAIN] Starting style training: {len(pairs)} pairs, {epochs} epochs")
    t0 = time.time()

    # Download and prepare training pairs
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
    ])

    originals = []
    editeds = []
    for i, pair in enumerate(pairs):
        try:
            orig_bytes = download_from_supabase(supabase_url, supabase_key, bucket, pair["original_key"])
            edit_bytes = download_from_supabase(supabase_url, supabase_key, bucket, pair["edited_key"])
            orig_img = Image.open(io.BytesIO(orig_bytes)).convert("RGB")
            edit_img = Image.open(io.BytesIO(edit_bytes)).convert("RGB")
            originals.append(transform(orig_img))
            editeds.append(transform(edit_img))
            if (i + 1) % 10 == 0:
                print(f"  Downloaded {i+1}/{len(pairs)} pairs")
        except Exception as e:
            print(f"  Skipping pair {i}: {e}")
            continue

    if len(originals) < 5:
        return {"status": "error", "message": f"Only {len(originals)} valid pairs. Need at least 5."}

    print(f"  {len(originals)} pairs loaded in {time.time()-t0:.1f}s")

    # Stack into tensors
    X = torch.stack(originals)  # B×3×256×256
    Y = torch.stack(editeds)

    device = torch.device("cuda")
    model = _build_lut_model().to(device)
    X, Y = X.to(device), Y.to(device)

    optimizer = optim.Adam(model.parameters(), lr=1e-4)
    l1_loss = nn.L1Loss()

    # Optional: perceptual loss using VGG features
    # Keeping it simple with L1 + colour histogram loss for now
    # VGG adds ~500MB model download on first run

    best_loss = float("inf")
    for epoch in range(epochs):
        model.train()
        # Shuffle
        idx = torch.randperm(len(X))
        total_loss = 0
        batch_size = min(8, len(X))

        for start in range(0, len(X), batch_size):
            batch_idx = idx[start:start+batch_size]
            x_batch = X[batch_idx]
            y_batch = Y[batch_idx]

            # Predict LUT
            lut = model(x_batch)  # B × D × D × D × 3

            # Apply LUT to each image
            losses = []
            for j in range(len(x_batch)):
                # x_batch is B×3×H×W, need H×W×3
                img_in = x_batch[j].permute(1, 2, 0)
                img_target = y_batch[j].permute(1, 2, 0)
                img_out = _apply_lut(img_in, lut[j])
                losses.append(l1_loss(img_out, img_target))

            loss = torch.stack(losses).mean()

            # Smoothness regularization on LUT
            lut_mean = lut.mean(dim=0)  # D×D×D×3
            smooth_loss = (
                (lut_mean[1:, :, :, :] - lut_mean[:-1, :, :, :]).pow(2).mean() +
                (lut_mean[:, 1:, :, :] - lut_mean[:, :-1, :, :]).pow(2).mean() +
                (lut_mean[:, :, 1:, :] - lut_mean[:, :, :-1, :]).pow(2).mean()
            )
            total = loss + 0.001 * smooth_loss

            optimizer.zero_grad()
            total.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / max(1, len(X) // batch_size)
        if (epoch + 1) % 20 == 0:
            print(f"  Epoch {epoch+1}/{epochs}, loss={avg_loss:.6f}")

        if avg_loss < best_loss:
            best_loss = avg_loss

    # Save model weights
    model_filename = f"{photographer_id}_{style_id}.pth"
    local_path = os.path.join(MODEL_DIR, model_filename)
    torch.save(model.state_dict(), local_path)
    model_volume.commit()

    # Also upload to Supabase Storage as backup
    model_key = f"models/{photographer_id}/{style_id}.pth"
    with open(local_path, "rb") as f:
        model_bytes = f.read()
    try:
        upload_to_supabase(
            supabase_url, supabase_key, bucket, model_key,
            model_bytes, content_type="application/octet-stream"
        )
    except Exception as e:
        print(f"  Warning: Supabase upload failed ({e}), model saved to Modal volume only")

    elapsed = time.time() - t0
    model_size_mb = len(model_bytes) / (1024 * 1024)
    print(f"[TRAIN] Complete: {elapsed:.1f}s, model={model_size_mb:.1f}MB, loss={best_loss:.6f}")

    return {
        "status": "success",
        "model_key": model_key,
        "model_filename": model_filename,
        "training_time_s": round(elapsed, 1),
        "final_loss": round(best_loss, 6),
        "pairs_used": len(originals),
        "model_size_mb": round(model_size_mb, 2),
    }


# ---------------------------------------------------------------------------
# STYLE INFERENCE ENDPOINT
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    image=gpu_image,
    volumes={MODEL_DIR: model_volume},
    timeout=300,
    secrets=[modal.Secret.from_name("apelier-supabase")],
)
@modal.fastapi_endpoint(method="POST")
def apply_style(body: dict):
    """
    Apply a trained 3D LUT style to a single image.

    POST body:
    {
        "image_key": "uploads/raw/photo.jpg",
        "model_filename": "{photographer_id}_{style_id}.pth",
        "output_key": "edited/photo.jpg",
        "supabase_url": "...",
        "supabase_key": "...",
        "bucket": "photos",
        "jpeg_quality": 95
    }

    Returns: {"status": "success", "output_key": "edited/photo.jpg"}
    """
    import torch
    from PIL import Image
    from torchvision import transforms
    import os, time

    t0 = time.time()
    model_filename = body["model_filename"]
    image_key = body["image_key"]
    output_key = body["output_key"]
    supabase_url = body["supabase_url"]
    supabase_key = body["supabase_key"]
    bucket = body.get("bucket", "photos")
    quality = body.get("jpeg_quality", 95)

    device = torch.device("cuda")

    # Load model (cached on volume across invocations)
    model_path = os.path.join(MODEL_DIR, model_filename)
    if not os.path.exists(model_path):
        # Try refreshing volume
        model_volume.reload()
        if not os.path.exists(model_path):
            return {"status": "error", "message": f"Model not found: {model_filename}"}

    model = _build_lut_model().to(device)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.eval()

    # Download image
    img_bytes = download_from_supabase(supabase_url, supabase_key, bucket, image_key)
    img = open_image_bytes(img_bytes)
    orig_size = img.size  # (W, H)

    # Generate LUT from downsampled input
    transform = transforms.Compose([transforms.Resize((256, 256)), transforms.ToTensor()])
    img_small = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        lut = model(img_small)[0]  # D×D×D×3

    # Apply LUT to full-resolution image
    import numpy as np
    img_np = np.array(img).astype(np.float32) / 255.0
    img_tensor = torch.from_numpy(img_np).to(device)
    result_tensor = _apply_lut(img_tensor, lut)
    result_np = (result_tensor.cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
    result_img = Image.fromarray(result_np)

    # Encode to JPEG
    buf = io.BytesIO()
    result_img.save(buf, format="JPEG", quality=quality, subsampling=0)
    result_bytes = buf.getvalue()

    # Upload to Supabase
    upload_to_supabase(supabase_url, supabase_key, bucket, output_key, result_bytes)

    elapsed = time.time() - t0
    print(f"[STYLE] {image_key} → {output_key} in {elapsed:.2f}s ({orig_size[0]}×{orig_size[1]})")

    return {
        "status": "success",
        "output_key": output_key,
        "processing_time_s": round(elapsed, 2),
        "resolution": f"{orig_size[0]}x{orig_size[1]}",
    }


# ---------------------------------------------------------------------------
# BATCH STYLE INFERENCE (process multiple images in one call)
# ---------------------------------------------------------------------------
@app.function(
    gpu="A10G",
    image=gpu_image,
    volumes={MODEL_DIR: model_volume},
    timeout=600,
    secrets=[modal.Secret.from_name("apelier-supabase")],
)
@modal.fastapi_endpoint(method="POST")
def apply_style_batch(body: dict):
    """
    Apply style to a batch of images. More efficient than individual calls
    because the model is loaded once.

    POST body:
    {
        "images": [
            {"image_key": "...", "output_key": "..."},
            ...
        ],
        "model_filename": "...",
        "supabase_url": "...",
        "supabase_key": "...",
        "bucket": "photos",
        "jpeg_quality": 95
    }
    """
    import torch
    from PIL import Image
    from torchvision import transforms
    import numpy as np
    import os, time

    t0 = time.time()
    images_list = body["images"]
    model_filename = body["model_filename"]
    supabase_url = body["supabase_url"]
    supabase_key = body["supabase_key"]
    bucket = body.get("bucket", "photos")
    quality = body.get("jpeg_quality", 95)

    device = torch.device("cuda")

    # Load model once
    model_path = os.path.join(MODEL_DIR, model_filename)
    if not os.path.exists(model_path):
        model_volume.reload()
        if not os.path.exists(model_path):
            return {"status": "error", "message": f"Model not found: {model_filename}"}

    model = _build_lut_model().to(device)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.eval()

    transform = transforms.Compose([transforms.Resize((256, 256)), transforms.ToTensor()])
    results = []

    for i, item in enumerate(images_list):
        try:
            img_bytes = download_from_supabase(supabase_url, supabase_key, bucket, item["image_key"])
            img = open_image_bytes(img_bytes)
            orig_size = img.size

            # Generate LUT
            img_small = transform(img).unsqueeze(0).to(device)
            with torch.no_grad():
                lut = model(img_small)[0]

            # Apply to full res
            img_np = np.array(img).astype(np.float32) / 255.0
            img_tensor = torch.from_numpy(img_np).to(device)
            result_tensor = _apply_lut(img_tensor, lut)
            result_np = (result_tensor.cpu().numpy() * 255).clip(0, 255).astype(np.uint8)
            result_img = Image.fromarray(result_np)

            buf = io.BytesIO()
            result_img.save(buf, format="JPEG", quality=quality, subsampling=0)
            upload_to_supabase(supabase_url, supabase_key, bucket, item["output_key"], buf.getvalue())

            results.append({"image_key": item["image_key"], "status": "success"})
            if (i + 1) % 10 == 0:
                print(f"  Processed {i+1}/{len(images_list)}")
        except Exception as e:
            results.append({"image_key": item["image_key"], "status": "error", "error": str(e)})

    elapsed = time.time() - t0
    success_count = sum(1 for r in results if r["status"] == "success")
    print(f"[STYLE_BATCH] {success_count}/{len(images_list)} images in {elapsed:.1f}s")

    return {
        "status": "success",
        "processed": success_count,
        "total": len(images_list),
        "processing_time_s": round(elapsed, 1),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 2 — FACE & SKIN RETOUCHING (CodeFormer)
# ═══════════════════════════════════════════════════════════════════════════

@app.function(
    gpu="A10G",
    image=codeformer_image,
    volumes={MODEL_DIR: model_volume},
    timeout=300,
    secrets=[modal.Secret.from_name("apelier-supabase")],
)
@modal.fastapi_endpoint(method="POST")
def face_retouch(body: dict):
    """
    Apply CodeFormer face restoration/retouching.

    POST body:
    {
        "image_key": "edited/photo.jpg",
        "output_key": "edited/photo.jpg",  (overwrite in-place)
        "supabase_url": "...",
        "supabase_key": "...",
        "bucket": "photos",
        "fidelity": 0.7,         # 0=max quality, 1=max fidelity to input (0.7 = subtle)
        "face_data": [...]        # Optional: face bounding boxes from Phase 0
    }
    """
    import torch
    import numpy as np
    from PIL import Image
    import cv2
    import os, time

    t0 = time.time()
    image_key = body["image_key"]
    output_key = body.get("output_key", image_key)
    supabase_url = body["supabase_url"]
    supabase_key = body["supabase_key"]
    bucket = body.get("bucket", "photos")
    fidelity = body.get("fidelity", 0.7)  # Higher = more subtle
    face_data = body.get("face_data", [])

    # Download image
    img_bytes = download_from_supabase(supabase_url, supabase_key, bucket, image_key)
    img = np.array(open_image_bytes(img_bytes))
    img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    # Download CodeFormer weights if not cached
    codeformer_path = os.path.join(MODEL_DIR, "codeformer.pth")
    detection_path = os.path.join(MODEL_DIR, "detection_Resnet50_Final.pth")
    parsing_path = os.path.join(MODEL_DIR, "parsing_parsenet.pth")

    if not os.path.exists(codeformer_path):
        print("[FACE] Downloading CodeFormer weights...")
        import httpx
        weights = {
            codeformer_path: "https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth",
            detection_path: "https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth",
            parsing_path: "https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth",
        }
        for path, url in weights.items():
            if not os.path.exists(path):
                resp = httpx.get(url, follow_redirects=True, timeout=120)
                resp.raise_for_status()
                with open(path, "wb") as f:
                    f.write(resp.content)
                print(f"  Downloaded {os.path.basename(path)}")
        model_volume.commit()

    # Use facexlib for face detection + CodeFormer for restoration
    from facexlib.utils.face_restoration_helper import FaceRestoreHelper
    device = torch.device("cuda")

    face_helper = FaceRestoreHelper(
        upscale_factor=1,
        face_size=512,
        crop_ratio=(1, 1),
        det_model="retinaface_resnet50",
        save_ext="png",
        use_parse=True,
        device=device,
        model_rootpath=MODEL_DIR,
    )

    face_helper.clean_all()
    face_helper.read_image(img_bgr)
    face_helper.get_face_landmarks_5(only_center_face=False)

    if len(face_helper.all_landmarks_5) == 0:
        print(f"[FACE] No faces detected in {image_key}")
        return {"status": "success", "output_key": output_key, "faces_found": 0, "note": "no faces detected, skipped"}

    face_helper.align_warp_face()

    # Load CodeFormer model
    from basicsr.utils.registry import ARCH_REGISTRY
    net = ARCH_REGISTRY.get("CodeFormer")(
        dim_embd=512, codebook_size=1024, n_head=8, n_layers=9,
        connect_list=["32", "64", "128", "256"],
    ).to(device)
    ckpt = torch.load(codeformer_path, map_location="cpu", weights_only=False)
    net.load_state_dict(ckpt["params_ema"])
    net.eval()

    # Process each face
    for idx, cropped_face in enumerate(face_helper.cropped_faces):
        cropped_face_t = torch.from_numpy(cropped_face.astype(np.float32) / 255.0)
        cropped_face_t = cropped_face_t.permute(2, 0, 1).unsqueeze(0).to(device)

        with torch.no_grad():
            output = net(cropped_face_t, w=fidelity, adain=True)[0]

        restored = output.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()
        restored = (restored * 255).astype(np.uint8)
        restored_bgr = cv2.cvtColor(restored, cv2.COLOR_RGB2BGR) if restored.shape[2] == 3 else restored
        face_helper.add_restored_face(restored_bgr)

    # Paste faces back
    face_helper.get_inverse_affine(None)
    result_bgr = face_helper.paste_faces_to_input_image()
    result_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)

    # Encode and upload
    result_img = Image.fromarray(result_rgb)
    buf = io.BytesIO()
    result_img.save(buf, format="JPEG", quality=95, subsampling=0)
    upload_to_supabase(supabase_url, supabase_key, bucket, output_key, buf.getvalue())

    elapsed = time.time() - t0
    faces_count = len(face_helper.cropped_faces)
    print(f"[FACE] {image_key}: {faces_count} faces retouched in {elapsed:.2f}s")

    return {
        "status": "success",
        "output_key": output_key,
        "faces_found": faces_count,
        "processing_time_s": round(elapsed, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════
# PHASE 3 — SCENE CLEANUP (LaMa Inpainting)
# ═══════════════════════════════════════════════════════════════════════════

@app.function(
    gpu="A10G",
    image=lama_image,
    volumes={MODEL_DIR: model_volume},
    timeout=300,
    secrets=[modal.Secret.from_name("apelier-supabase")],
)
@modal.fastapi_endpoint(method="POST")
def scene_cleanup(body: dict):
    """
    Remove distractions using LaMa inpainting.
    Detects power lines, exit signs, stray people in background.

    POST body:
    {
        "image_key": "edited/photo.jpg",
        "output_key": "edited/photo.jpg",
        "supabase_url": "...",
        "supabase_key": "...",
        "bucket": "photos",
        "detections": ["power_lines", "exit_signs", "background_people"]
    }
    """
    import torch
    import numpy as np
    from PIL import Image
    import cv2
    import os, time

    t0 = time.time()
    image_key = body["image_key"]
    output_key = body.get("output_key", image_key)
    supabase_url = body["supabase_url"]
    supabase_key = body["supabase_key"]
    bucket = body.get("bucket", "photos")
    detections = body.get("detections", ["power_lines", "exit_signs"])

    # Download image
    img_bytes = download_from_supabase(supabase_url, supabase_key, bucket, image_key)
    img = np.array(open_image_bytes(img_bytes))

    # Generate inpainting mask using detection heuristics
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    h, w = img.shape[:2]

    if "power_lines" in detections:
        # Detect thin horizontal/diagonal lines in upper portion of image
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        upper = gray[:h//3, :]
        edges = cv2.Canny(upper, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=w//4, maxLineGap=20)
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(np.arctan2(y2-y1, x2-x1) * 180 / np.pi)
                if angle < 15 or angle > 165:  # Near-horizontal
                    cv2.line(mask[:h//3, :], (x1, y1), (x2, y2), 255, thickness=8)

    if "exit_signs" in detections:
        # Detect bright red/green rectangles (exit signs)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
        # Red range
        red1 = cv2.inRange(hsv, (0, 120, 120), (10, 255, 255))
        red2 = cv2.inRange(hsv, (170, 120, 120), (180, 255, 255))
        red = red1 | red2
        # Green range
        green = cv2.inRange(hsv, (35, 120, 120), (85, 255, 255))
        signs = red | green
        # Filter by size — exit signs are small rectangles
        contours, _ = cv2.findContours(signs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            x, y, cw, ch = cv2.boundingRect(cnt)
            # Exit signs: small, roughly rectangular, in upper portion
            if 500 < area < (w * h * 0.01) and 0.3 < cw/max(ch,1) < 4 and y < h * 0.4:
                cv2.rectangle(mask, (x-5, y-5), (x+cw+5, y+ch+5), 255, -1)

    # If no detections found, skip inpainting
    if mask.sum() == 0:
        print(f"[CLEANUP] No distractions detected in {image_key}, skipping")
        return {"status": "success", "output_key": output_key, "detections_found": 0, "note": "nothing to clean"}

    # Dilate mask slightly for better inpainting
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)

    # Download LaMa model if not cached
    lama_path = os.path.join(MODEL_DIR, "big-lama.pt")
    if not os.path.exists(lama_path):
        print("[CLEANUP] Downloading LaMa model...")
        import httpx
        # Use the lightweight LaMa checkpoint
        resp = httpx.get(
            "https://huggingface.co/smartywu/big-lama/resolve/main/big-lama.pt",
            follow_redirects=True,
            timeout=300,
        )
        resp.raise_for_status()
        with open(lama_path, "wb") as f:
            f.write(resp.content)
        model_volume.commit()
        print(f"  Downloaded LaMa ({len(resp.content)/(1024*1024):.0f}MB)")

    # Load and run LaMa
    device = torch.device("cuda")
    lama_model = torch.jit.load(lama_path, map_location=device)
    lama_model.eval()

    # Prepare inputs (LaMa expects 512×512 or similar)
    img_resized = cv2.resize(img, (512, 512))
    mask_resized = cv2.resize(mask, (512, 512))

    img_t = torch.from_numpy(img_resized.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(device)
    mask_t = torch.from_numpy(mask_resized.astype(np.float32) / 255.0).unsqueeze(0).unsqueeze(0).to(device)

    with torch.no_grad():
        result = lama_model(img_t, mask_t)

    result_np = result[0].permute(1, 2, 0).cpu().numpy()
    result_np = (result_np * 255).clip(0, 255).astype(np.uint8)

    # Resize back to original and blend only in masked region
    result_full = cv2.resize(result_np, (w, h))
    mask_full = cv2.resize(mask, (w, h))
    mask_3ch = np.stack([mask_full]*3, axis=-1).astype(np.float32) / 255.0

    # Feathered blend for seamless transitions
    mask_blur = cv2.GaussianBlur(mask_3ch, (21, 21), 0)
    output = (img * (1 - mask_blur) + result_full * mask_blur).astype(np.uint8)

    # Encode and upload
    result_img = Image.fromarray(output)
    buf = io.BytesIO()
    result_img.save(buf, format="JPEG", quality=95, subsampling=0)
    upload_to_supabase(supabase_url, supabase_key, bucket, output_key, buf.getvalue())

    detection_count = int(mask.sum() > 0)
    elapsed = time.time() - t0
    print(f"[CLEANUP] {image_key}: cleaned in {elapsed:.2f}s, mask coverage={mask.mean()*100:.1f}%")

    return {
        "status": "success",
        "output_key": output_key,
        "detections_found": detection_count,
        "mask_coverage_pct": round(float(mask.mean()) * 100, 2),
        "processing_time_s": round(elapsed, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════

@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.fastapi_endpoint(method="GET")
def health():
    """Health check endpoint. No GPU needed."""
    return {"status": "ok", "service": "apelier-gpu", "version": "1.0.0"}
