from __future__ import annotations

from typing import Dict, Literal, Tuple

Decision = Literal["ACCEPT", "LOW_CONFIDENCE", "ABSTAIN"]

def decide_with_reason(trust: Dict[str, object]) -> Tuple[Decision, str, str]:
    diagnostics = trust.get("diagnostics", {}) or {}
    trust_score = float(trust.get("trust_score", 0.0))
    refuted_ratio = float(diagnostics.get("refuted_ratio", 0.0))
    core_uncertain_mass_avg = float(diagnostics.get("core_uncertain_mass_avg", diagnostics.get("uncertain_mass_avg", 0.0)))
    core_refute_mass_avg = float(diagnostics.get("core_refute_mass_avg", diagnostics.get("refute_mass_avg", 0.0)))
    critical_refuted = int(diagnostics.get("critical_refuted", 0))
    supports_final_refuted = int(diagnostics.get("supports_final_refuted", 0))
    per_claim = diagnostics.get("per_claim", {}) or {}
    core_total = int(diagnostics.get("core_claims_total", 0))
    core_supported_fully = int(diagnostics.get("core_claims_supported_fully", 0))
    core_partially_supported = int(diagnostics.get("core_claims_partially_supported", 0))
    core_uncertain = int(diagnostics.get("core_claims_uncertain", 0))
    core_refuted = int(diagnostics.get("core_claims_refuted", 0))

    # Rule-based, non-LLM aggregation:
    # - Any critical refutation, or refuting claims that support the final conclusion -> ABSTAIN
    # - Large refuted share -> ABSTAIN
    # - Otherwise map by trust_score thresholds:
    #     >=0.80 -> ACCEPT
    #     0.55-0.80 -> LOW_CONFIDENCE
    #     <0.55 -> ABSTAIN
    core_summary = (
        f"core claims: fully_supported={core_supported_fully}, "
        f"partially_supported={core_partially_supported}, "
        f"uncertain={core_uncertain}, refuted={core_refuted}, total={core_total}"
    )

    if critical_refuted > 0 or supports_final_refuted > 0:
        return "ABSTAIN", "A core/critical claim is refuted, so abstain.", core_summary
    if refuted_ratio >= 0.34:
        return "ABSTAIN", "Too many claims are refuted overall, so abstain.", core_summary

    # If any core claim collapses to ~0 score, abstain.
    for _, info in per_claim.items():
        if not info.get("is_core"):
            continue
        try:
            if float(info.get("score", 1.0)) <= 0.05:
                return "ABSTAIN", "A core claim collapses to near-zero score, so abstain.", core_summary
        except Exception:
            continue

    # Explicit core-chain decision rules:
    # - Any core refutation => ABSTAIN
    # - Multiple core uncertain OR large core-uncertainty mass => ABSTAIN
    # - Some core uncertainty => LOW_CONFIDENCE
    # - Otherwise, if most core claims are supported => ACCEPT
    if core_refuted > 0 or core_refute_mass_avg >= 0.10:
        return "ABSTAIN", "Core claims show refutation mass, so abstain.", core_summary
    if core_uncertain >= 2 or core_uncertain_mass_avg >= 0.35:
        return "ABSTAIN", "Core chain has high uncertainty (multiple uncertain core claims or high uncertainty mass), so abstain.", core_summary
    if core_uncertain >= 1 or core_partially_supported >= 1 or core_uncertain_mass_avg >= 0.20:
        return "LOW_CONFIDENCE", "Core chain has some uncertainty, so downgrade to LOW_CONFIDENCE.", core_summary

    # Threshold mapping as a backstop (should align with the rules above).
    if trust_score < 0.55:
        return "ABSTAIN", "Core trust score is below 0.55, so abstain.", core_summary
    if trust_score < 0.80:
        return "LOW_CONFIDENCE", "Core trust score is between 0.55 and 0.80, so LOW_CONFIDENCE.", core_summary

    # Majority of core claims must be fully supported for ACCEPT.
    if core_total > 0 and (core_supported_fully / core_total) < 0.67:
        return "LOW_CONFIDENCE", "Not enough core claims are fully supported to accept confidently.", core_summary
    return "ACCEPT", "No core refutations and most core claims are fully supported, so ACCEPT.", core_summary


def decide(trust: Dict[str, object]) -> Decision:
    decision, _, _ = decide_with_reason(trust)
    return decision
