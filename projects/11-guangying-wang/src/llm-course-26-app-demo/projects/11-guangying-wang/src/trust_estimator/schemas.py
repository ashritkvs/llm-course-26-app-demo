from __future__ import annotations

from typing import Any, Dict


def draft_answer_schema() -> Dict[str, Any]:
    return {
        "name": "draft_answer",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "reasoning_summary": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1},
                    "minItems": 2,
                    "maxItems": 8,
                },
                "final_answer": {"type": "string", "minLength": 1},
                "draft_answer": {"type": "string", "minLength": 1},
            },
            "required": ["reasoning_summary", "final_answer", "draft_answer"],
        },
    }


def claims_schema(max_claims: int) -> Dict[str, Any]:
    return {
        "name": "extracted_claims",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "claims": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": max(3, max_claims),
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "claim_id": {"type": "string", "minLength": 1},
                            "text": {"type": "string", "minLength": 1},
                            "category": {
                                "type": "string",
                                "enum": [
                                    "definition",
                                    "fact",
                                    "assumption",
                                    "mechanism",
                                    "calculation",
                                    "intermediate_conclusion",
                                    "final_conclusion",
                                    "other",
                                ],
                            },
                            "supports_final": {"type": "boolean"},
                            "critical": {"type": "boolean"},
                        },
                        "required": ["claim_id", "text", "category", "supports_final", "critical"],
                    },
                }
            },
            "required": ["claims"],
        },
    }


def verification_questions_schema(per_claim_questions: int) -> Dict[str, Any]:
    return {
        "name": "verification_questions",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "questions": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "question_id": {"type": "string", "minLength": 1},
                            "question": {"type": "string", "minLength": 1},
                            "expected_answer_type": {
                                "type": "string",
                                "enum": ["short_fact", "definition", "explanation", "calculation", "yes_no"],
                            },
                        },
                        "required": ["question_id", "question", "expected_answer_type"],
                    },
                }
            },
            "required": ["questions"],
        },
    }


def verification_answer_schema() -> Dict[str, Any]:
    return {
        "name": "verification_answer",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "answer": {"type": "string", "minLength": 1},
                "stance_wrt_claim": {"type": "string", "enum": ["SUPPORTS", "REFUTES", "UNCERTAIN"]},
                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                "rationale_brief": {"type": "string", "minLength": 1},
            },
            "required": ["answer", "stance_wrt_claim", "confidence", "rationale_brief"],
        },
    }

