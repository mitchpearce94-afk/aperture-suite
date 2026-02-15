"""
Supabase Storage helpers — download originals, upload processed images.
"""
import logging
from typing import Optional
from app.config import get_supabase, get_settings

log = logging.getLogger(__name__)


def download_photo(storage_key: str) -> Optional[bytes]:
    """Download a photo from Supabase Storage by its key."""
    try:
        sb = get_supabase()
        bucket = get_settings().storage_bucket
        return sb.storage_download(bucket, storage_key)
    except Exception as e:
        log.error(f"Failed to download {storage_key}: {e}")
        return None


def upload_photo(storage_key: str, data: bytes, content_type: str = "image/jpeg") -> Optional[str]:
    """Upload a processed photo to Supabase Storage. Returns the key on success."""
    try:
        sb = get_supabase()
        bucket = get_settings().storage_bucket
        ok = sb.storage_upload(bucket, storage_key, data, content_type)
        return storage_key if ok else None
    except Exception as e:
        log.error(f"Failed to upload {storage_key}: {e}")
        return None
