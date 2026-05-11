from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from backend.models.errors import ConfigError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        extra="ignore",
    )

    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_jwt_audience: str | None = None

    cors_allow_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias="CORS_ALLOW_ORIGINS",
    )

    storage_backend: Literal["local", "supabase"] = "local"
    local_storage_root: str = "./storage"
    supabase_storage_bucket: str = "documents"

    embedding_provider: Literal["local_hash", "openai"] = "local_hash"
    local_embedding_dimensions: int = 256
    openai_api_key: str | None = None
    openai_embedding_model: str = "text-embedding-3-small"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    gemini_api_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: float = 120.0

    chroma_persist_directory: str = Field(
        default="./storage/chromadb",
        validation_alias="CHROMA_PERSIST_PATH",
    )
    chroma_collection_name: str = "document_chunks"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _parse_cors_allow_origins(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                return ["http://localhost:3000"]
            if normalized.startswith("["):
                parsed = json.loads(normalized)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [origin.strip() for origin in normalized.split(",") if origin.strip()]
        return value

    def validate_required_secrets(self) -> None:
        missing: list[str] = []
        required_values = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_KEY": self.supabase_service_key,
            "SUPABASE_JWT_SECRET": self.supabase_jwt_secret,
            "GEMINI_API_KEY": self.gemini_api_key,
        }

        for name, value in required_values.items():
            if value is None or not value.strip():
                missing.append(name)

        if missing:
            raise ConfigError(
                f"Missing required environment variables: {', '.join(sorted(missing))}"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
