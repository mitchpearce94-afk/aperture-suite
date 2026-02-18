"""
Configuration — environment variables and lightweight Supabase client via httpx.
No heavy SDK dependencies — just REST API calls.
"""
import httpx
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    storage_bucket: str = "photos"
    max_concurrent_images: int = 4
    web_res_max_px: int = 2048
    thumb_max_px: int = 400
    jpeg_quality: int = 95
    web_quality: int = 92
    thumb_quality: int = 80

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


class SupabaseClient:
    """Lightweight Supabase client using httpx — no SDK needed."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.supabase_url
        self.api_key = s.supabase_service_role_key
        self.headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def _rest_url(self, table: str) -> str:
        return f"{self.base_url}/rest/v1/{table}"

    def _storage_url(self, path: str = "") -> str:
        return f"{self.base_url}/storage/v1{path}"

    @staticmethod
    def _sanitize(obj):
        """Convert numpy types and other non-JSON-serializable values to native Python."""
        import numpy as np
        if isinstance(obj, dict):
            return {k: SupabaseClient._sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [SupabaseClient._sanitize(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
        return obj

    # ── Table Operations ──

    def select(self, table: str, columns: str = "*", filters: dict | None = None, order: str | None = None) -> list[dict]:
        params = {"select": columns}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        r = httpx.get(self._rest_url(table), headers=self.headers, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def select_single(self, table: str, columns: str = "*", filters: dict | None = None) -> Optional[dict]:
        headers = {**self.headers, "Accept": "application/vnd.pgrst.object+json"}
        params = {"select": columns}
        if filters:
            params.update(filters)
        r = httpx.get(self._rest_url(table), headers=headers, params=params, timeout=30)
        if r.status_code == 406:
            return None
        r.raise_for_status()
        return r.json()

    def insert(self, table: str, data: dict) -> Optional[dict]:
        r = httpx.post(self._rest_url(table), headers=self.headers, json=data, timeout=30)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def update(self, table: str, id_or_data, data_or_filters=None) -> Optional[dict]:
        """Update records. Supports two patterns:
        - update(table, record_id: str, data: dict) — by ID
        - update(table, data: dict, filters: dict) — by filters (legacy)
        """
        if isinstance(id_or_data, str):
            # Pattern: update(table, record_id, data)
            params = {"id": f"eq.{id_or_data}"}
            clean = self._sanitize(data_or_filters or {})
        else:
            # Pattern: update(table, data, filters)
            params = data_or_filters or {}
            clean = self._sanitize(id_or_data)
        r = httpx.patch(self._rest_url(table), headers=self.headers, json=clean, params=params, timeout=30)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def update_many(self, table: str, data: dict, in_filter: tuple[str, list[str]]) -> bool:
        col, ids = in_filter
        params = {col: f"in.({','.join(ids)})"}
        r = httpx.patch(self._rest_url(table), headers=self.headers, json=data, params=params, timeout=30)
        r.raise_for_status()
        return True

    # ── Storage Operations ──

    def storage_download(self, bucket: str, path: str) -> Optional[bytes]:
        url = self._storage_url(f"/object/{bucket}/{path}")
        headers = {"apikey": self.api_key, "Authorization": f"Bearer {self.api_key}"}
        r = httpx.get(url, headers=headers, timeout=60, follow_redirects=True)
        if r.status_code != 200:
            return None
        return r.content

    def storage_upload(self, bucket: str, path: str, data: bytes, content_type: str = "image/jpeg") -> bool:
        url = self._storage_url(f"/object/{bucket}/{path}")
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        r = httpx.put(url, headers=headers, content=data, timeout=120)
        return r.status_code in (200, 201)


_client: Optional[SupabaseClient] = None


def get_supabase() -> SupabaseClient:
    global _client
    if _client is None:
        _client = SupabaseClient()
    return _client


# Module-level convenience exports (used by orchestrator and other modules)
settings = get_settings()
supabase = get_supabase()
