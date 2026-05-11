from __future__ import annotations

import time
from uuid import uuid4

import httpx
import jwt
from backend.config.settings import Settings, get_settings
from backend.main import create_app
from backend.middleware import auth
from backend.middleware.auth import AuthenticatedUser, get_current_user
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends
from fastapi.testclient import TestClient


def _build_app() -> TestClient:
    settings = Settings(
        supabase_url="https://project-ref.supabase.co",
        supabase_anon_key="anon-key",
        supabase_service_key="service-role-key",
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings

    @app.get("/api/test-auth")
    async def protected_endpoint(
        user: AuthenticatedUser = Depends(get_current_user),
    ) -> dict[str, str | None]:
        return {"id": str(user.id), "email": user.email}

    return TestClient(app)


def _build_jwks_and_token(*, user_id: str, email: str, exp: int) -> tuple[dict[str, object], str]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    kid = "test-kid"

    jwk = jwt.algorithms.ECAlgorithm.to_jwk(public_key, as_dict=True)
    jwk["kid"] = kid
    jwk["use"] = "sig"
    jwk["alg"] = "ES256"

    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "iss": "https://project-ref.supabase.co/auth/v1",
            "role": "authenticated",
            "iat": int(time.time()) - 5,
            "exp": exp,
        },
        private_key,
        algorithm="ES256",
        headers={"kid": kid},
    )
    return {"keys": [jwk]}, token


def _mock_jwks_response(monkeypatch, jwks_payload: dict[str, object]) -> None:
    async def fake_get(self, url: str, *, headers=None):
        return httpx.Response(
            status_code=200,
            json=jwks_payload,
            headers={"cache-control": "public, max-age=60"},
            request=httpx.Request("GET", url, headers=headers),
        )

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)


def setup_function() -> None:
    auth._jwks_cache.clear()
    auth._jwks_locks.clear()


def test_valid_token_returns_authenticated_user(monkeypatch) -> None:
    client = _build_app()
    user_id = str(uuid4())
    jwks_payload, token = _build_jwks_and_token(
        user_id=user_id,
        email="student@example.com",
        exp=int(time.time()) + 3600,
    )
    _mock_jwks_response(monkeypatch, jwks_payload)

    response = client.get("/api/test-auth", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == {"id": user_id, "email": "student@example.com"}


def test_missing_authorization_header_returns_401() -> None:
    client = _build_app()

    response = client.get("/api/test-auth")

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing Authorization header"}


def test_malformed_authorization_header_returns_401() -> None:
    client = _build_app()

    response = client.get("/api/test-auth", headers={"Authorization": "Token nope"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid Authorization header"}


def test_expired_token_returns_generic_401(monkeypatch) -> None:
    client = _build_app()
    jwks_payload, token = _build_jwks_and_token(
        user_id=str(uuid4()),
        email="student@example.com",
        exp=int(time.time()) - 60,
    )
    _mock_jwks_response(monkeypatch, jwks_payload)

    response = client.get("/api/test-auth", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token"}


def test_jwks_timeout_returns_503_without_leaking_exception(monkeypatch) -> None:
    client = _build_app()
    _, token = _build_jwks_and_token(
        user_id=str(uuid4()),
        email="student@example.com",
        exp=int(time.time()) + 3600,
    )

    async def fake_get(self, url: str, *, headers=None):
        raise httpx.ConnectTimeout("secret upstream timeout details")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    response = client.get("/api/test-auth", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication service unavailable"}
    assert "secret upstream timeout details" not in response.text


def test_invalid_signature_does_not_expose_internal_details(monkeypatch) -> None:
    client = _build_app()
    jwks_payload, _ = _build_jwks_and_token(
        user_id=str(uuid4()),
        email="student@example.com",
        exp=int(time.time()) + 3600,
    )
    _, invalid_token = _build_jwks_and_token(
        user_id=str(uuid4()),
        email="student@example.com",
        exp=int(time.time()) + 3600,
    )
    _mock_jwks_response(monkeypatch, jwks_payload)

    response = client.get(
        "/api/test-auth",
        headers={"Authorization": f"Bearer {invalid_token}"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token"}
    assert "Signature verification failed" not in response.text
