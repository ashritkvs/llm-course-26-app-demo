"""
auth.py — Google OAuth token verification and user management

Verifies Google ID tokens, upserts users in Supabase, and issues JWT session tokens.
"""

import os
import jwt
import datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")

# Add parent dir to path for execution imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from execution.supabase_client import supabase


def verify_google_token(token: str) -> dict:
    """
    Verify a Google ID token and return the user info.

    Args:
        token: Google ID token from the frontend.

    Returns:
        Dict with google_id, email, name, picture.

    Raises:
        ValueError: If the token is invalid.
    """
    idinfo = id_token.verify_oauth2_token(
        token, google_requests.Request(), GOOGLE_CLIENT_ID
    )
    return {
        "google_id": idinfo["sub"],
        "email": idinfo["email"],
        "display_name": idinfo.get("name", ""),
        "avatar_url": idinfo.get("picture", ""),
    }


def upsert_user(user_info: dict) -> dict:
    """
    Create or update a user in Supabase.

    Args:
        user_info: Dict with google_id, email, display_name, avatar_url.

    Returns:
        The user row from the database.
    """
    result = (
        supabase.table("users")
        .upsert(user_info, on_conflict="google_id")
        .execute()
    )
    return result.data[0]


def create_session_token(user: dict) -> str:
    """
    Create a JWT session token for an authenticated user.

    Args:
        user: User row dict (must include 'id' and 'email').

    Returns:
        JWT token string.
    """
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_session_token(token: str) -> dict:
    """
    Decode and validate a JWT session token.

    Args:
        token: JWT token string.

    Returns:
        Decoded payload dict.

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError: If the token is invalid.
    """
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
