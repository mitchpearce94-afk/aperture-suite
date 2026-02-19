"""
Database helpers — update processing_jobs, photos, galleries via Supabase REST API.
"""
import logging
from typing import Optional
from datetime import datetime, timezone
from app.config import get_supabase

log = logging.getLogger(__name__)


# ── Processing Jobs ──────────────────────────────────────────

def update_processing_job(job_id: str, **fields):
    try:
        sb = get_supabase()
        sb.update("processing_jobs", job_id, fields)
    except Exception as e:
        log.error(f"Failed to update processing_job {job_id}: {e}")


def set_job_phase(job_id: str, phase: str, processed: Optional[int] = None):
    fields = {"current_phase": phase, "status": "processing"}
    if processed is not None:
        fields["processed_images"] = processed
    update_processing_job(job_id, **fields)


def complete_job(job_id: str, total: int):
    update_processing_job(
        job_id,
        status="completed",
        processed_images=total,
        current_phase="complete",
        completed_at=datetime.now(timezone.utc).isoformat(),
    )


def fail_job(job_id: str, error: str):
    update_processing_job(
        job_id,
        status="failed",
        error_log=error,
        completed_at=datetime.now(timezone.utc).isoformat(),
    )


# ── Photos ───────────────────────────────────────────────────

def get_gallery_photos(gallery_id: str) -> list[dict]:
    try:
        sb = get_supabase()
        return sb.select("photos", {"gallery_id": gallery_id}, order="sort_order.asc")
    except Exception as e:
        log.error(f"Failed to fetch photos for gallery {gallery_id}: {e}")
        return []


def update_photo(photo_id: str, **fields):
    try:
        sb = get_supabase()
        sb.update("photos", photo_id, fields)
    except Exception as e:
        log.error(f"Failed to update photo {photo_id}: {e}")


def bulk_update_photos(photo_ids: list[str], **fields):
    try:
        sb = get_supabase()
        sb.update_many("photos", fields, ("id", photo_ids))
    except Exception as e:
        log.error(f"Failed to bulk update photos: {e}")


# ── Jobs ─────────────────────────────────────────────────────

def update_job_status(job_id: str, status: str):
    try:
        sb = get_supabase()
        sb.update("jobs", job_id, {"status": status})
    except Exception as e:
        log.error(f"Failed to update job {job_id} status: {e}")


# ── Galleries ────────────────────────────────────────────────

def get_gallery(gallery_id: str) -> Optional[dict]:
    try:
        sb = get_supabase()
        return sb.select_single("galleries", {"id": gallery_id}, columns="*, job:jobs(id, status)")
    except Exception as e:
        log.error(f"Failed to fetch gallery {gallery_id}: {e}")
        return None


def update_gallery(gallery_id: str, **fields):
    try:
        sb = get_supabase()
        sb.update("galleries", gallery_id, fields)
    except Exception as e:
        log.error(f"Failed to update gallery {gallery_id}: {e}")


# ── Style Profiles ───────────────────────────────────────────

def get_style_profile(profile_id: str) -> Optional[dict]:
    try:
        sb = get_supabase()
        return sb.select_single("style_profiles", {"id": profile_id})
    except Exception as e:
        log.error(f"Failed to fetch style profile {profile_id}: {e}")
        return None


def get_photographer_default_style(photographer_id: str) -> Optional[dict]:
    """
    Get the first 'ready' style profile for a photographer.
    """
    try:
        sb = get_supabase()
        profiles = sb.select(
            "style_profiles",
            {"photographer_id": photographer_id, "status": "ready"},
            order="created_at.desc",
        )
        return profiles[0] if profiles else None
    except Exception as e:
        log.error(f"Failed to fetch default style for photographer {photographer_id}: {e}")
        return None


def validate_style_profile_ownership(profile_id: str, photographer_id: str) -> bool:
    """Verify that a style profile belongs to the given photographer."""
    try:
        profile = get_style_profile(profile_id)
        if not profile:
            return False
        return profile.get("photographer_id") == photographer_id
    except Exception:
        return False


def update_style_profile(profile_id: str, **fields):
    try:
        sb = get_supabase()
        sb.update("style_profiles", profile_id, fields)
    except Exception as e:
        log.error(f"Failed to update style profile {profile_id}: {e}")
