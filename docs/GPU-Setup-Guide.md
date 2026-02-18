# Apelier GPU Setup — Modal Deployment Guide

**Date:** 18 February 2026  
**Goal:** Deploy GPU processing (style transfer, face retouching, scene cleanup) to Modal serverless A10G.  
**Result:** Processing time drops from ~97s/photo (CPU) to ~2-4s/photo (GPU).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User uploads photos → Next.js → /api/process           │
│                                                          │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │  Railway (CPU)    │────▶│  Modal (GPU — A10G)      │  │
│  │                   │     │                           │  │
│  │  Phase 0: Analysis│     │  Phase 1: Neural Style   │  │
│  │  Phase 4: Crop    │     │  Phase 2: CodeFormer     │  │
│  │  Phase 5: Output  │     │  Phase 3: LaMa Cleanup   │  │
│  │                   │◀────│                           │  │
│  │  orchestrator.py  │     │  modal_app.py            │  │
│  └──────────────────┘     └──────────────────────────┘  │
│                                                          │
│  Images flow through Supabase Storage (no file transfer  │
│  between Railway ↔ Modal — both read/write to Supabase)  │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Railway and Modal never transfer image bytes to each other. Both services read from and write to Supabase Storage. Railway tells Modal "process image at key X, write result to key Y" via HTTP.

---

## Files Created

```
services/ai-engine/
├── app/
│   ├── modal/
│   │   ├── __init__.py           # empty
│   │   ├── modal_app.py          # THE Modal deployment file (all GPU endpoints)
│   │   └── client.py             # HTTP client for Railway → Modal calls
│   ├── pipeline/
│   │   └── orchestrator.py       # UPDATED — routes phases through Modal
│   └── routers/
│       └── style.py              # UPDATED — supports before/after pair training
```

---

## Step 1: Modal Account Setup (5 min)

1. Go to **modal.com** → Sign up (free $30/month credits)
2. Install Modal CLI locally:
   ```powershell
   python -m pip install modal
   ```
3. Create API token:
   ```powershell
   python -m modal token new
   ```
   This saves credentials to `~/.modal.toml`

4. Create a Modal secret for Supabase credentials:
   ```powershell
   python -m modal secret create apelier-supabase `
     SUPABASE_URL=https://ibugbyrbjabpveybuqsv.supabase.co `
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

---

## Step 2: Deploy Modal App (2 min)

Copy `modal_app.py` to your project:

```powershell
# Copy files to project
Move-Item -Path "$env:USERPROFILE\Downloads\modal_app.py" -Destination "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\modal\modal_app.py" -Force
Move-Item -Path "$env:USERPROFILE\Downloads\modal_client.py" -Destination "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\modal\client.py" -Force
Move-Item -Path "$env:USERPROFILE\Downloads\orchestrator_gpu.py" -Destination "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\pipeline\orchestrator.py" -Force
Move-Item -Path "$env:USERPROFILE\Downloads\style_router_gpu.py" -Destination "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\routers\style.py" -Force
```

Create the `__init__.py`:
```powershell
New-Item -ItemType File -Path "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\modal\__init__.py" -Force
```

Deploy to Modal:
```powershell
cd "C:\Users\mitch\OneDrive\Documents\aperture-suite\services\ai-engine\app\modal"
python -m modal deploy modal_app.py
```

Modal will output URLs like:
```
✓ Created apelier-gpu.
├── 🔗 https://your-workspace--apelier-gpu-health.modal.run
├── 🔗 https://your-workspace--apelier-gpu-train-style.modal.run
├── 🔗 https://your-workspace--apelier-gpu-apply-style.modal.run
├── 🔗 https://your-workspace--apelier-gpu-apply-style-batch.modal.run
├── 🔗 https://your-workspace--apelier-gpu-face-retouch.modal.run
└── 🔗 https://your-workspace--apelier-gpu-scene-cleanup.modal.run
```

**Copy the health URL** — you need the workspace prefix (everything before `--`).

---

## Step 3: Configure Railway (2 min)

Add these environment variables to your Railway AI engine:

| Variable | Value |
|----------|-------|
| `MODAL_BASE_URL` | `https://your-workspace--apelier-gpu-health.modal.run` |

The client extracts the workspace prefix and constructs URLs for each function.

**Add `modal` to requirements.txt** (not strictly needed since we use HTTP, but good for future):
```
# Add to services/ai-engine/requirements.txt
httpx>=0.25.0
```
(httpx should already be there)

---

## Step 4: Test Endpoints (5 min)

Test health check:
```powershell
curl https://your-workspace--apelier-gpu-health.modal.run
# Should return: {"status":"ok","service":"apelier-gpu","version":"1.0.0"}
```

Test style inference (after training a model):
```powershell
curl -X POST https://your-workspace--apelier-gpu-apply-style.modal.run `
  -H "Content-Type: application/json" `
  -d '{
    "image_key": "uploads/raw/test.jpg",
    "model_filename": "test_model.pth",
    "output_key": "edited/test.jpg",
    "supabase_url": "https://ibugbyrbjabpveybuqsv.supabase.co",
    "supabase_key": "your-key",
    "bucket": "photos"
  }'
```

---

## Step 5: Supabase Migration (1 min)

Add new columns to `style_profiles` table for neural model support:

```sql
-- Run in Supabase SQL Editor
ALTER TABLE style_profiles
  ADD COLUMN IF NOT EXISTS training_method text DEFAULT 'histogram',
  ADD COLUMN IF NOT EXISTS model_key text,
  ADD COLUMN IF NOT EXISTS model_filename text,
  ADD COLUMN IF NOT EXISTS training_time_s float,
  ADD COLUMN IF NOT EXISTS pairs_used integer,
  ADD COLUMN IF NOT EXISTS training_error text;

-- Add comment for clarity
COMMENT ON COLUMN style_profiles.training_method IS 'histogram (CPU) or neural_lut (GPU)';
COMMENT ON COLUMN style_profiles.model_key IS 'Supabase Storage path to trained .pth weights';
COMMENT ON COLUMN style_profiles.model_filename IS 'Filename on Modal volume: {photographer_id}_{style_id}.pth';
```

---

## Step 6: Deploy Updated AI Engine to Railway

```powershell
cd "C:\Users\mitch\OneDrive\Documents\aperture-suite"
git add services/ai-engine/
git commit -m "feat: GPU processing via Modal — neural style, CodeFormer face retouch, LaMa cleanup"
git push
```

Railway auto-deploys from push.

---

## How It Works End-to-End

### Training a Style (one-time per style profile)
1. Photographer goes to Settings → Editing Style
2. Clicks "Train New Style" → uploads 50-100 before/after pairs
3. Frontend sends pairs to `/api/style/train`
4. AI engine fires background task → calls Modal `train_style` endpoint
5. Modal downloads pairs from Supabase, trains 3D LUT model (~10-15 min)
6. Trained weights saved to Modal volume + Supabase Storage backup
7. Style profile updated with `model_key`, `training_status: completed`
8. Frontend polls `/api/style/status/{id}` until done

### Processing a Gallery (every upload)
1. Photographer uploads photos → triggers `/api/process`
2. Orchestrator starts pipeline with `style_profile_id`
3. **Phase 0** (CPU): Analysis, face detection, quality scoring — same as before
4. **Phase 1** (GPU): Orchestrator calls Modal `apply_style_batch` — sends batch of image keys
   - Modal loads trained model from volume, processes all images in parallel
   - Each image: download from Supabase → predict LUT → apply LUT → upload edited back
   - ~1-2s per image on A10G
   - Falls back to CPU preset method if Modal unavailable
5. **Phase 2** (GPU): For each photo with detected faces, calls Modal `face_retouch`
   - CodeFormer restores/retouches faces with fidelity=0.7 (subtle)
   - ~2-3s per image
6. **Phase 3** (GPU): Calls Modal `scene_cleanup` on each photo
   - Detects power lines and exit signs via CV heuristics
   - LaMa inpaints detected regions
   - Skips photos with no detections (fast)
7. **Phase 4** (CPU): Composition/crop — same as before
8. **Phase 5** (CPU): Generate web/thumb variants, upload to Supabase — same as before

### Total Processing Time
- **Before (CPU only):** ~97s × 200 photos = ~5.4 hours per wedding
- **After (GPU):** ~3-4s × 200 photos = ~10-13 minutes per wedding
- **Speedup: ~25×**

---

## Cost Analysis

| Component | Cost per Image | 200 Photos | 500 Photos |
|-----------|---------------|------------|------------|
| Phase 1 (Style) | A$0.002 | A$0.40 | A$1.00 |
| Phase 2 (Face) | A$0.003 | A$0.60 | A$1.50 |
| Phase 3 (Cleanup) | A$0.002 | A$0.40 | A$1.00 |
| **Total GPU** | **A$0.007** | **A$1.40** | **A$3.50** |

Training a style: ~A$2-3 one-time per style profile.

**Margins stay at 80-90%+ across all tiers** as verified in our earlier cost model.

---

## Troubleshooting

**"Model not found" error:**
- Model hasn't been trained yet, or Modal volume was cleared
- Re-train the style or check Supabase Storage for backup `.pth` file

**Cold start takes 10-15s first time:**
- Normal for first request after idle. Modal caches container after first hit.
- Subsequent requests: <2s warmup

**"Modal unavailable" in logs:**
- Orchestrator auto-falls back to CPU. Check Modal dashboard for service status.
- Verify `MODAL_BASE_URL` env var on Railway is correct.

**Training fails "only N valid pairs":**
- Need at least 5 valid before/after pairs
- Check that original_key and edited_key paths exist in Supabase Storage

---

## What's NOT in This Deploy

These need separate frontend work (next sessions):

1. **Before/after pair upload UI** — Settings page needs a new upload mode with two drop zones
2. **Style profile selector in upload flow** — Pick which trained style to apply per job
3. **Re-edit with different style** — Select photos in review → apply different style
4. **Training progress indicator** — Poll `/api/style/status/{id}` and show progress bar
