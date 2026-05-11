from functools import lru_cache
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    claude_api_key: str = ""
    claude_model: str = "claude-3-5-sonnet-20241022"
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return [value]
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
