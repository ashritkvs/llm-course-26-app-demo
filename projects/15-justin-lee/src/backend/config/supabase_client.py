from __future__ import annotations

from functools import lru_cache

from fastapi import Depends
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from backend.config.settings import Settings, get_settings
from backend.middleware.auth import get_bearer_token
from backend.models.errors import ConfigError


@lru_cache
def _create_admin_client(url: str, key: str) -> Client:
    return create_client(url, key)


def get_admin_client(settings: Settings = Depends(get_settings)) -> Client:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
    return _create_admin_client(settings.supabase_url, settings.supabase_service_key)


def get_user_client(
    token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings),
) -> Client:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise ConfigError("SUPABASE_URL and SUPABASE_ANON_KEY are required")

    options = SyncClientOptions(
        headers={"Authorization": f"Bearer {token}"},
        auto_refresh_token=False,
        persist_session=False,
    )
    return create_client(settings.supabase_url, settings.supabase_anon_key, options=options)


def get_supabase_client(settings: Settings = Depends(get_settings)) -> Client:
    return get_admin_client(settings)
