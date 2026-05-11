from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, NoReturn
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status

from backend.config.settings import Settings, get_settings
from backend.models.errors import ConfigError, UnauthorizedError

logger = logging.getLogger(__name__)

_JWKS_CACHE_TTL_SECONDS = 600.0
_UPSTREAM_AUTH_ERROR_DETAIL = "Authentication service unavailable"
_VALID_JWT_ALGORITHMS = {"ES256", "RS256", "HS256"}


@dataclass(frozen=True)
class _CachedJwks:
    keys_by_kid: dict[str, dict[str, Any]]
    expires_at: float


_jwks_cache: dict[str, _CachedJwks] = {}
_jwks_locks: dict[str, asyncio.Lock] = {}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None


def _raise_unauthorized(
    detail: str,
    *,
    alg: str | None = None,
    kid: str | None = None,
    exc: Exception | None = None,
) -> NoReturn:
    logger.error(
        "Auth validation failed: detail=%s alg=%s kid=%s exc=%s",
        detail,
        alg,
        kid,
        str(exc) if exc else None,
        exc_info=exc if exc else False,
    )
    if exc is None:
        raise UnauthorizedError(detail)
    raise UnauthorizedError(detail) from exc


def get_bearer_token(request: Request) -> str:
    raw = request.headers.get("authorization")
    if not raw:
        _raise_unauthorized("Missing Authorization header")
    parts = raw.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        _raise_unauthorized("Invalid Authorization header")
    return parts[1].strip()


def _auth_issuer(settings: Settings) -> str:
    if not settings.supabase_url:
        raise ConfigError("SUPABASE_URL is required")
    return f"{settings.supabase_url.rstrip('/')}/auth/v1"


def _jwks_url(settings: Settings) -> str:
    return f"{_auth_issuer(settings)}/certs"


def _jwt_audience(settings: Settings) -> str | None:
    audience = settings.supabase_jwt_audience
    if audience is None:
        return "authenticated"

    normalized = audience.strip()
    if not normalized:
        return None
    return normalized


def _auth_api_key(settings: Settings) -> str:
    if not settings.supabase_anon_key:
        raise ConfigError("SUPABASE_ANON_KEY is required")
    return settings.supabase_anon_key


def _get_jwks_lock(jwks_url: str) -> asyncio.Lock:
    lock = _jwks_locks.get(jwks_url)
    if lock is None:
        lock = asyncio.Lock()
        _jwks_locks[jwks_url] = lock
    return lock


def _parse_cache_ttl(headers: httpx.Headers) -> float:
    cache_control = headers.get("cache-control", "")
    for directive in cache_control.split(","):
        directive = directive.strip()
        if directive.startswith("max-age="):
            try:
                return max(float(directive.split("=", 1)[1]), 0.0)
            except ValueError:
                break
    return _JWKS_CACHE_TTL_SECONDS


def _normalize_jwks(payload: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(payload, dict):
        raise ValueError("JWKS payload is not an object")

    keys = payload.get("keys")
    if not isinstance(keys, list):
        raise ValueError("JWKS payload is missing keys")

    normalized: dict[str, dict[str, Any]] = {}
    for key in keys:
        if not isinstance(key, dict):
            continue
        kid = key.get("kid")
        if isinstance(kid, str) and kid:
            normalized[kid] = key

    if not normalized:
        raise ValueError("JWKS payload does not contain any signing keys")

    return normalized


async def _fetch_jwks(settings: Settings) -> _CachedJwks:
    jwks_url = _jwks_url(settings)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            response = await client.get(
                jwks_url,
                headers={"Accept": "application/json"},
            )
        response.raise_for_status()
        keys_by_kid = _normalize_jwks(response.json())
    except httpx.TimeoutException as exc:
        logger.warning("Timed out fetching Supabase JWKS from %s", jwks_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Failed to fetch Supabase JWKS from %s", jwks_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Supabase JWKS endpoint returned %s for %s",
            exc.response.status_code,
            jwks_url,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except ValueError as exc:
        logger.error("Supabase JWKS payload was invalid for %s", jwks_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc

    ttl_seconds = _parse_cache_ttl(response.headers)
    return _CachedJwks(
        keys_by_kid=keys_by_kid,
        expires_at=time.monotonic() + ttl_seconds,
    )


async def _validate_hs256_token_via_auth_server(
    *,
    token: str,
    settings: Settings,
    alg: str | None,
    kid: str | None,
) -> AuthenticatedUser:
    user_url = f"{_auth_issuer(settings)}/user"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            response = await client.get(
                user_url,
                headers={
                    "Accept": "application/json",
                    "apikey": _auth_api_key(settings),
                    "Authorization": f"Bearer {token}",
                },
            )
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as exc:
        logger.warning("Timed out validating HS256 token via %s", user_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Failed to validate HS256 token via %s", user_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {401, 403}:
            _raise_unauthorized("Invalid or expired token", alg=alg, kid=kid, exc=exc)
        logger.warning(
            "Supabase Auth /user endpoint returned %s for %s",
            exc.response.status_code,
            user_url,
            exc_info=exc,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc
    except ValueError as exc:
        logger.error("Supabase Auth /user payload was invalid for %s", user_url, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_UPSTREAM_AUTH_ERROR_DETAIL,
        ) from exc

    user_id = payload.get("id")
    if not isinstance(user_id, str):
        _raise_unauthorized("Invalid token subject", alg=alg, kid=kid)

    try:
        parsed_user_id = UUID(user_id)
    except ValueError as exc:
        _raise_unauthorized("Invalid token subject", alg=alg, kid=kid, exc=exc)

    email = payload.get("email")
    return AuthenticatedUser(
        id=parsed_user_id,
        email=email if isinstance(email, str) else None,
    )


def _decode_token(
    *,
    token: str,
    settings: Settings,
    algorithm: str,
    key: Any,
) -> dict[str, Any]:
    audience = _jwt_audience(settings)
    return jwt.decode(
        token,
        key=key,
        algorithms=[algorithm],
        issuer=_auth_issuer(settings),
        audience=audience,
        options={
            "require": ["exp", "sub", "iss"],
            "verify_aud": audience is not None,
        },
    )


async def _get_signing_jwk(settings: Settings, kid: str, alg: str | None = None) -> dict[str, Any]:
    jwks_url = _jwks_url(settings)
    cached = _jwks_cache.get(jwks_url)
    now = time.monotonic()
    if cached and cached.expires_at > now and kid in cached.keys_by_kid:
        return cached.keys_by_kid[kid]

    async with _get_jwks_lock(jwks_url):
        cached = _jwks_cache.get(jwks_url)
        now = time.monotonic()
        if cached and cached.expires_at > now and kid in cached.keys_by_kid:
            return cached.keys_by_kid[kid]

        stale_jwk = cached.keys_by_kid.get(kid) if cached else None
        try:
            refreshed = await _fetch_jwks(settings)
        except HTTPException:
            if stale_jwk is not None:
                logger.warning("Using stale JWKS for kid=%s after refresh failure", kid)
                return stale_jwk
            raise

        _jwks_cache[jwks_url] = refreshed
        jwk = refreshed.keys_by_kid.get(kid)
        if jwk is None:
            _raise_unauthorized("Invalid or expired token", alg=alg, kid=kid)
        return jwk


async def get_current_user(
    request: Request,
    token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    cached_user = getattr(request.state, "authenticated_user", None)
    if isinstance(cached_user, AuthenticatedUser):
        return cached_user

    alg: str | None = None
    kid: str | None = None
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        _raise_unauthorized("Invalid or expired token", exc=exc)

    raw_alg = header.get("alg")
    raw_kid = header.get("kid")
    alg = raw_alg if isinstance(raw_alg, str) else None
    kid = raw_kid if isinstance(raw_kid, str) and raw_kid else None
    if alg not in _VALID_JWT_ALGORITHMS:
        _raise_unauthorized("Invalid or expired token", alg=alg, kid=kid)

    if alg == "HS256":
        return await _validate_hs256_token_via_auth_server(
            token=token,
            settings=settings,
            alg=alg,
            kid=kid,
        )
    else:
        if kid is None:
            _raise_unauthorized("Invalid or expired token", alg=alg, kid=kid)

        jwk = await _get_signing_jwk(settings, kid, alg)

        try:
            signing_key = jwt.PyJWK.from_dict(jwk, algorithm=alg).key
            payload = _decode_token(
                token=token,
                settings=settings,
                algorithm=alg,
                key=signing_key,
            )
        except HTTPException:
            raise
        except jwt.PyJWTError as exc:
            _raise_unauthorized("Invalid or expired token", alg=alg, kid=kid, exc=exc)

    subject = payload.get("sub")
    if not isinstance(subject, str):
        _raise_unauthorized("Invalid token subject", alg=alg, kid=kid)

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        _raise_unauthorized("Invalid token subject", alg=alg, kid=kid, exc=exc)

    email = payload.get("email")
    user = AuthenticatedUser(id=user_id, email=email if isinstance(email, str) else None)
    request.state.authenticated_user = user
    return user
