from __future__ import annotations

import argparse
import json
import sys

from trust_estimator.checker import check_trust
from trust_estimator.claim_extractor import extract_claims
from trust_estimator.decision import decide_with_reason
from trust_estimator.generator import generate_draft_answer
from trust_estimator.lang import detect_lang, normalize_lang
from trust_estimator.llm import LLMClient, LLMConfig, TemplateMismatchError
from trust_estimator.verifier import verify_claims


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Trust estimation for natural-science Q&A: claim-level verification (CoVe-style) plus rule-based aggregation."
    )
    parser.add_argument("question", nargs="?", help="Question text. If omitted, input is read from stdin.")
    parser.add_argument("--model", default="gpt-4o", help="OpenAI model name (default: gpt-4o).")
    parser.add_argument(
        "--lang",
        default="auto",
        choices=["auto", "zh", "en"],
        help="Output language: auto, zh, or en.",
    )
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-output-tokens", type=int, default=900)
    parser.add_argument("--reasoning-effort", default=None, help="Optional reasoning.effort value, e.g. low/medium/high.")
    parser.add_argument("--max-claims", type=int, default=8)
    parser.add_argument("--per-claim-questions", type=int, default=3, choices=[2, 3, 4], help="Number of verification questions per claim (2-4).")
    parser.add_argument("--mock", action="store_true", help="Deterministic demo mode without API calls.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    question = args.question
    if not question:
        question = sys.stdin.read().strip()
    if not question:
        raise SystemExit("No question provided (arg or stdin).")

    lang = normalize_lang(args.lang, question)

    llm = LLMClient(
        mock=args.mock,
        config=LLMConfig(
            model=args.model,
            temperature=args.temperature,
            max_output_tokens=args.max_output_tokens,
            reasoning_effort=args.reasoning_effort,
        ),
    )

    try:
        draft = generate_draft_answer(llm, question, lang=lang)
        claims = extract_claims(llm, question, draft["draft_answer"], max_claims=args.max_claims, lang=lang)
        verification = verify_claims(
            llm,
            question=question,
            draft_answer=draft["draft_answer"],
            claims=claims,
            per_claim_questions=args.per_claim_questions,
            lang=lang,
        )

        trust = check_trust(claims, verification["verification_answers"])
        decision, decision_reason, core_failure_summary = decide_with_reason(trust)
        trust["diagnostics"]["decision_reason"] = decision_reason
        trust["diagnostics"]["core_failure_summary"] = core_failure_summary
    except TemplateMismatchError as e:
        output = {
            "error": {
                "type": "TEMPLATE_MISMATCH",
                "message": str(e),
                "detected_topic": e.detected_topic,
                "supported_topics": e.supported_topics,
            },
            "question": question,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 2

    output = {
        "question": question,
        "draft_answer": draft["draft_answer"],
        "extracted_claims": claims,
        "verification_questions": verification["verification_questions"],
        "verification_answers": verification["verification_answers"],
        "trust_score": trust["trust_score"],
        "decision": decision,
        "diagnostics": trust["diagnostics"],
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
