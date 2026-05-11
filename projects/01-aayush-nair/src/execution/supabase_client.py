"""
supabase_client.py — Shared Supabase helper

Initializes and exports a Supabase client using credentials from .env.
All other execution scripts import the client from here.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from the project root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
