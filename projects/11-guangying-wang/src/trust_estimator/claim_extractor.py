from __future__ import annotations

from typing import Any, Dict, List

from .llm import LLMClient
from .schemas import claims_schema


def extract_claims(
    llm: LLMClient,
    question: str,
    draft_answer: str,
    *,
    max_claims: int = 8,
    lang: str = "en",
) -> List[Dict[str, Any]]:
    if lang == "zh":
        system = (
            "Extract key, atomic claims from a draft answer in natural science.\n"
            "Claims should be specific enough to verify, avoid redundancy, and cover intermediate conclusions, key facts, and mechanisms.\n"
            "Prioritize core claims that directly support the final conclusion; keep auxiliary or contrast information only when helpful.\n"
            "For each claim, mark whether it supports the final conclusion (supports_final).\n"
            "Mark a claim as critical if refuting it would likely overturn or substantially weaken the final conclusion.\n"
            "Do not introduce claims that are not stated or implied in the draft answer.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
        user_tail = "\n\nReturn 4-" + str(max_claims) + " claims."
    else:
        system = (
            "Extract key, atomic claims from a draft answer in natural science.\n"
            "Claims should be specific enough to verify, avoid redundancy, and capture intermediate conclusions.\n"
            "Prioritize core claims that directly support the final conclusion; keep auxiliary/contrast claims only if needed.\n"
            "Mark whether each claim supports the final conclusion (supports_final).\n"
            "Mark claim as critical if refuting it would likely flip or invalidate the final conclusion.\n"
            "Do NOT add new claims not implied by the draft answer.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
        user_tail = "\n\nReturn 4-" + str(max_claims) + " claims."

    messages = [
        (
            "system",
            system,
        ),
        (
            "user",
            "QUESTION:\n"
            + question
            + "\n\nDRAFT_ANSWER:\n"
            + draft_answer
            + user_tail,
        ),
    ]

    schema = claims_schema(max_claims=max_claims)
    data = llm.structured(messages=messages, schema=schema)
    claims = data["claims"]

    # Defensive normalization.
    seen = set()
    normalized: List[Dict[str, Any]] = []
    for i, c in enumerate(claims):
        claim_id = str(c.get("claim_id") or f"C{i+1}")
        if claim_id in seen:
            claim_id = f"{claim_id}_{i+1}"
        seen.add(claim_id)
        normalized.append(
            {
                "claim_id": claim_id,
                "text": str(c["text"]).strip(),
                "category": c["category"],
                "supports_final": bool(c["supports_final"]),
                "critical": bool(c["critical"]),
            }
        )
    return normalized
