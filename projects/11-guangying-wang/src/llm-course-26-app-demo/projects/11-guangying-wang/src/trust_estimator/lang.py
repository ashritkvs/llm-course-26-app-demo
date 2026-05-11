from __future__ import annotations

from typing import Literal

Lang = Literal["zh", "en"]


def detect_lang(text: str) -> Lang:
    # Simple heuristic: any CJK Unified Ideographs -> zh, else en.
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            return "zh"
    return "en"


def normalize_lang(lang_arg: str, question: str) -> Lang:
    if lang_arg == "auto":
        return detect_lang(question)
    if lang_arg in ("zh", "en"):
        return lang_arg  # type: ignore[return-value]
    return "en"

