import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load env from common locations without overriding real environment vars.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_CANDIDATES = (
    PROJECT_ROOT / ".env",
    PROJECT_ROOT / "app" / "services" / ".env",
)
for env_file in ENV_CANDIDATES:
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=False)


class Settings:
    def __init__(self) -> None:
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
