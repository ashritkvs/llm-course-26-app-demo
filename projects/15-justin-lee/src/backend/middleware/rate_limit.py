"""In-process sliding-window rate limiter.

State lives in a module-level dict and does NOT survive server restarts.
This is intentional for MVP: the limiter protects against accidental hammering
within a single server session, not distributed or adversarial attacks. If
multi-process or cross-restart persistence is needed in future, replace
_call_log with a Redis-backed store.

Thread safety: CPython's GIL serialises dict access, which is sufficient for
the async FastAPI context (single-threaded event loop + background threads).

Applied to the three most expensive endpoints:
  POST /api/workspaces/{id}/generation-requests   — max 5 per user per minute
  POST /api/workspaces/{id}/profile/generate      — max 3 per user per minute
  POST /api/workspaces/{id}/regeneration-requests — max 5 per user per minute
"""
from __future__ import annotations

import time
from collections import defaultdict
from uuid import UUID

from backend.models.errors import TooManyRequestsError

_WINDOW_SECONDS = 60

# (user_id_str, endpoint_key) -> list of monotonic timestamps for recent calls
_call_log: dict[tuple[str, str], list[float]] = defaultdict(list)


def check_rate_limit(*, user_id: UUID | str, endpoint: str, max_calls: int) -> None:
    """Raise TooManyRequestsError if the user has exceeded max_calls in the last 60s.

    Prunes stale timestamps on every call to prevent unbounded memory growth.
    The endpoint parameter is a short string key identifying the route, e.g.
    "generation" or "profile_generate".
    """
    now = time.monotonic()
    key = (str(user_id), endpoint)
    window_start = now - _WINDOW_SECONDS

    _call_log[key] = [t for t in _call_log[key] if t > window_start]

    if len(_call_log[key]) >= max_calls:
        oldest = min(_call_log[key])
        retry_after = int(_WINDOW_SECONDS - (now - oldest)) + 1
        raise TooManyRequestsError(
            f"Rate limit exceeded. Try again in {retry_after} seconds."
        )

    _call_log[key].append(now)


def reset_rate_limit_state() -> None:
    """Clear all in-process rate limit state. Intended for use in tests only."""
    _call_log.clear()
