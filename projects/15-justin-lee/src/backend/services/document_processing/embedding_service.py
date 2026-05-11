from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from backend.config.settings import Settings
from backend.models.errors import ConfigError

_TOKEN_RE = re.compile(r"[A-Za-z0-9_]+")


class EmbeddingProvider(Protocol):
    @property
    def model_name(self) -> str: ...

    def embed_texts(self, *, texts: Sequence[str]) -> list[list[float]]: ...


@dataclass(frozen=True)
class HashingEmbeddingProvider:
    dimensions: int = 256

    @property
    def model_name(self) -> str:
        return f"local-hash-{self.dimensions}d-v1"

    def embed_texts(self, *, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed_single(text=text) for text in texts]

    def _embed_single(self, *, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = _TOKEN_RE.findall(text.lower()) or [text.strip().lower() or "__empty__"]

        for token in tokens:
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16).digest()
            bucket = int.from_bytes(digest[:8], "big") % self.dimensions
            sign = 1.0 if digest[8] % 2 == 0 else -1.0
            vector[bucket] += sign

        norm = math.sqrt(sum(component * component for component in vector))
        if norm == 0:
            return vector
        return [component / norm for component in vector]


class OpenAIEmbeddingProvider:
    def __init__(self, *, api_key: str, model_name: str) -> None:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ConfigError(
                "OpenAI embeddings require the 'openai' package to be installed."
            ) from exc

        self._client = OpenAI(api_key=api_key)
        self._model_name = model_name

    @property
    def model_name(self) -> str:
        return self._model_name

    def embed_texts(self, *, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []

        response = self._client.embeddings.create(
            model=self._model_name,
            input=list(texts),
        )
        return [list(item.embedding) for item in response.data]


class EmbeddingService:
    def __init__(self, provider: EmbeddingProvider) -> None:
        self._provider = provider

    @property
    def model_name(self) -> str:
        return self._provider.model_name

    def embed_text(self, *, text: str) -> list[float]:
        embeddings = self.embed_texts(texts=[text])
        return embeddings[0] if embeddings else []

    def embed_texts(self, *, texts: Sequence[str]) -> list[list[float]]:
        normalized_texts = [text.strip() for text in texts]
        return self._provider.embed_texts(texts=normalized_texts)


def build_embedding_service(settings: Settings) -> EmbeddingService:
    if settings.embedding_provider == "openai":
        if not settings.openai_api_key:
            raise ConfigError("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai")

        provider: EmbeddingProvider = OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model_name=settings.openai_embedding_model,
        )
    else:
        provider = HashingEmbeddingProvider(dimensions=settings.local_embedding_dimensions)

    return EmbeddingService(provider)
