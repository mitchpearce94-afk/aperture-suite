"""
Apelier Modal GPU Client — HTTP bridge from Railway AI engine to Modal endpoints.

Usage in orchestrator.py:
    from app.modal.client import ModalClient
    modal_client = ModalClient()
    result = await modal_client.apply_style(image_key, model_filename, output_key)

All methods are async and return dicts with status/results.
Falls back gracefully if Modal is unavailable.
"""

import httpx
import os
import logging
from typing import Optional

logger = logging.getLogger("apelier.modal")

# Modal web endpoint base URL — set after `modal deploy modal_app.py`
# Format: https://{workspace}--apelier-gpu-{function_name}.modal.run
MODAL_BASE_URL = os.environ.get("MODAL_BASE_URL", "")

# Supabase credentials (passed to Modal so it can read/write storage)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STORAGE_BUCKET = os.environ.get("STORAGE_BUCKET", "photos")


class ModalClient:
    """HTTP client for calling Modal GPU endpoints from Railway."""

    def __init__(
        self,
        base_url: str = MODAL_BASE_URL,
        supabase_url: str = SUPABASE_URL,
        supabase_key: str = SUPABASE_SERVICE_ROLE_KEY,
        bucket: str = STORAGE_BUCKET,
        timeout: float = 600,
    ):
        self.base_url = base_url.rstrip("/")
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.bucket = bucket
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=timeout)

    @property
    def is_configured(self) -> bool:
        """Check if Modal endpoints are configured."""
        return bool(self.base_url and self.supabase_url and self.supabase_key)

    def _endpoint_url(self, function_name: str) -> str:
        """Build the full URL for a Modal function endpoint.

        After `modal deploy`, each @fastapi_endpoint gets a URL like:
        https://{workspace}--apelier-gpu-{function_name}.modal.run

        We store just the base prefix and append function name.
        """
        # If base_url includes the full pattern already, use it directly
        # Otherwise construct from workspace prefix
        if "modal.run" in self.base_url:
            # User set full URL template: https://workspace--apelier-gpu-{fn}.modal.run
            # Replace last segment
            parts = self.base_url.rsplit("--", 1)
            if len(parts) == 2:
                return f"{parts[0]}--apelier-gpu-{function_name.replace('_', '-')}.modal.run"
        return f"{self.base_url}/{function_name}"

    def _base_body(self) -> dict:
        """Common fields included in every request."""
        return {
            "supabase_url": self.supabase_url,
            "supabase_key": self.supabase_key,
            "bucket": self.bucket,
        }

    async def health(self) -> dict:
        """Check if Modal endpoints are reachable."""
        try:
            url = self._endpoint_url("health")
            resp = await self._client.get(url, timeout=10)
            return resp.json()
        except Exception as e:
            logger.warning(f"Modal health check failed: {e}")
            return {"status": "error", "message": str(e)}

    # ─── Phase 1: Style Transfer ──────────────────────────────────────

    async def train_style(
        self,
        photographer_id: str,
        style_profile_id: str,
        pairs: list[dict],
        epochs: int = 200,
    ) -> dict:
        """Train a 3D LUT style model.

        Args:
            pairs: [{"original_key": "...", "edited_key": "..."}, ...]
        Returns:
            {"status": "success", "model_key": "...", "model_filename": "..."}
        """
        url = self._endpoint_url("train_style")
        body = {
            **self._base_body(),
            "photographer_id": photographer_id,
            "style_profile_id": style_profile_id,
            "pairs": pairs,
            "epochs": epochs,
        }
        try:
            logger.info(f"Training style: {len(pairs)} pairs, {epochs} epochs")
            resp = await self._client.post(url, json=body, timeout=1800)
            result = resp.json()
            logger.info(f"Training complete: {result.get('training_time_s', '?')}s")
            return result
        except Exception as e:
            logger.error(f"Style training failed: {e}")
            return {"status": "error", "message": str(e)}

    async def apply_style(
        self,
        image_key: str,
        model_filename: str,
        output_key: str,
        jpeg_quality: int = 95,
    ) -> dict:
        """Apply trained style to a single image."""
        url = self._endpoint_url("apply_style")
        body = {
            **self._base_body(),
            "image_key": image_key,
            "model_filename": model_filename,
            "output_key": output_key,
            "jpeg_quality": jpeg_quality,
        }
        try:
            resp = await self._client.post(url, json=body)
            return resp.json()
        except Exception as e:
            logger.error(f"Style apply failed for {image_key}: {e}")
            return {"status": "error", "message": str(e)}

    async def apply_style_batch(
        self,
        images: list[dict],
        model_filename: str,
        jpeg_quality: int = 95,
    ) -> dict:
        """Apply style to multiple images in one call.

        Args:
            images: [{"image_key": "...", "output_key": "..."}, ...]
        """
        url = self._endpoint_url("apply_style_batch")
        body = {
            **self._base_body(),
            "images": images,
            "model_filename": model_filename,
            "jpeg_quality": jpeg_quality,
        }
        try:
            logger.info(f"Batch style: {len(images)} images")
            resp = await self._client.post(url, json=body)
            return resp.json()
        except Exception as e:
            logger.error(f"Batch style failed: {e}")
            return {"status": "error", "message": str(e)}

    # ─── Phase 2: Face Retouching ─────────────────────────────────────

    async def face_retouch(
        self,
        image_key: str,
        output_key: Optional[str] = None,
        fidelity: float = 0.7,
        face_data: Optional[list] = None,
    ) -> dict:
        """Apply CodeFormer face restoration.

        Args:
            fidelity: 0 = max quality, 1 = max fidelity to input. 0.7 = subtle/natural.
        """
        url = self._endpoint_url("face_retouch")
        body = {
            **self._base_body(),
            "image_key": image_key,
            "output_key": output_key or image_key,
            "fidelity": fidelity,
        }
        if face_data:
            body["face_data"] = face_data
        try:
            resp = await self._client.post(url, json=body)
            return resp.json()
        except Exception as e:
            logger.error(f"Face retouch failed for {image_key}: {e}")
            return {"status": "error", "message": str(e)}

    # ─── Phase 3: Scene Cleanup ───────────────────────────────────────

    async def scene_cleanup(
        self,
        image_key: str,
        output_key: Optional[str] = None,
        detections: Optional[list[str]] = None,
    ) -> dict:
        """Remove distractions (power lines, exit signs, etc.)."""
        url = self._endpoint_url("scene_cleanup")
        body = {
            **self._base_body(),
            "image_key": image_key,
            "output_key": output_key or image_key,
            "detections": detections or ["power_lines", "exit_signs"],
        }
        try:
            resp = await self._client.post(url, json=body)
            return resp.json()
        except Exception as e:
            logger.error(f"Scene cleanup failed for {image_key}: {e}")
            return {"status": "error", "message": str(e)}

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()
