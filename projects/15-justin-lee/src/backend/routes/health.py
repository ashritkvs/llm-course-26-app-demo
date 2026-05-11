from __future__ import annotations

import datetime as dt

from fastapi import APIRouter

# Auth summary: this router intentionally exposes GET /api/health without auth.
# All other API routers enforce Supabase JWT validation via router-level Depends(get_current_user).
router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "timestamp": dt.datetime.now(dt.UTC).isoformat()}
