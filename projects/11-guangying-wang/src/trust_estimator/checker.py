from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Mapping

ClaimStatus = Literal["SUPPORTED", "REFUTED", "UNCERTAIN"]


@dataclass(frozen=True)
class ClaimCheck:
    status: ClaimStatus
    support: float
    refute: float
    uncertain: float


def _aggregate_answers(answers: List[Dict[str, Any]]) -> ClaimCheck:
    support = 0.0
    refute = 0.0
    uncertain = 0.0

    for a in answers:
        conf = float(a.get("confidence", 0.0))
        stance = a.get("stance_wrt_claim", "UNCERTAIN")
        if stance == "SUPPORTS":
            support += conf
        elif stance == "REFUTES":
            refute += conf
        else:
            uncertain += conf

    total = support + refute + uncertain
    if total > 0:
        support /= total
        refute /= total
        uncertain /= total

    if refute >= 0.6 and support <= 0.2:
        status: ClaimStatus = "REFUTED"
    elif support >= 0.6 and refute <= 0.2:
        status = "SUPPORTED"
    else:
        status = "UNCERTAIN"

    return ClaimCheck(status=status, support=support, refute=refute, uncertain=uncertain)


@dataclass(frozen=True)
class ScoringParams:
    # Penalties in: score = support - u_pen*uncertain - r_pen*refute
    core_chain_uncertainty_penalty: float = 0.95  # critical && supports_final
    core_chain_refute_penalty: float = 1.6
    core_uncertainty_penalty: float = 0.6  # critical || supports_final
    core_refute_penalty: float = 1.25
    aux_uncertainty_penalty: float = 0.2
    aux_refute_penalty: float = 0.8

    # Weights for overall aggregation
    weight_core_chain: float = 2.0
    weight_critical: float = 1.6
    weight_supports_final: float = 1.3
    weight_aux: float = 1.0

    # Hard cutoffs for key claims
    core_refute_hard_cutoff: float = 0.25
    core_chain_uncertain_hard_cutoff: float = 0.6

    # Thresholds used for "fully/partially supported" labeling
    fully_supported_uncertain_max: float = 0.15
    fully_supported_refute_max: float = 0.05


def _claim_score(
    agg: ClaimCheck,
    *,
    critical: bool,
    supports_final: bool,
    params: ScoringParams,
) -> float:
    # Score uses the full mass (support/uncertain/refute) and varies penalties by claim importance.
    #
    # Goals:
    # - Non-critical uncertainty should only mildly reduce the overall score.
    # - Critical / supports-final refutation must heavily reduce the score (and may trigger ABSTAIN elsewhere).
    #
    # We use: score = support - alpha*uncertain - beta*refute, clipped to [0, 1].
    # Core chain: critical AND supports_final => strongest uncertainty/refute penalty.
    if critical and supports_final:
        alpha = params.core_chain_uncertainty_penalty
        beta = params.core_chain_refute_penalty
    elif critical or supports_final:
        alpha = params.core_uncertainty_penalty
        beta = params.core_refute_penalty
    else:
        alpha = params.aux_uncertainty_penalty
        beta = params.aux_refute_penalty

    # Additional hard penalty when a key claim has substantial refute mass.
    if (critical or supports_final) and agg.refute >= params.core_refute_hard_cutoff:
        return 0.0
    if critical and supports_final and agg.uncertain >= params.core_chain_uncertain_hard_cutoff:
        return 0.0

    raw = agg.support - alpha * agg.uncertain - beta * agg.refute
    if raw < 0.0:
        return 0.0
    if raw > 1.0:
        return 1.0
    return raw


def check_trust(
    claims: List[Dict[str, Any]],
    verification_answers: Mapping[str, List[Dict[str, Any]]],
    *,
    params: ScoringParams | None = None,
) -> Dict[str, Any]:
    params = params or ScoringParams()
    per_claim: Dict[str, Dict[str, Any]] = {}

    supported_count = 0
    refuted_count = 0
    uncertain_count = 0
    critical_refuted = 0
    supports_final_refuted = 0

    # Aggregate across ALL claims (for transparency diagnostics).
    support_mass_sum_all = 0.0
    refute_mass_sum_all = 0.0
    uncertain_mass_sum_all = 0.0
    score_sum_all = 0.0
    weight_sum_all = 0.0

    # Aggregate across CORE claims (for trust_score).
    support_mass_sum_core = 0.0
    refute_mass_sum_core = 0.0
    uncertain_mass_sum_core = 0.0
    score_sum_core = 0.0
    weight_sum_core = 0.0

    # Aggregate across AUXILIARY claims (for light correction / transparency).
    support_mass_sum_aux = 0.0
    refute_mass_sum_aux = 0.0
    uncertain_mass_sum_aux = 0.0
    score_sum_aux = 0.0
    weight_sum_aux = 0.0

    claims_with_any_uncertainty = 0
    claims_with_any_refute = 0
    core_claims_total = 0
    core_claims_with_any_uncertainty = 0
    core_claims_with_any_refute = 0
    core_claims_supported_fully = 0
    core_claims_partially_supported = 0
    core_claims_uncertain = 0
    core_claims_refuted = 0
    failure_mode_counts: Dict[str, int] = {}

    for c in claims:
        claim_id = c["claim_id"]
        answers = list(verification_answers.get(claim_id, []))
        for a in answers:
            fr = a.get("relevance_check_failure_reason")
            if fr:
                failure_mode_counts[str(fr)] = failure_mode_counts.get(str(fr), 0) + 1
        agg = _aggregate_answers(answers) if answers else ClaimCheck("UNCERTAIN", 0.0, 0.0, 1.0)
        critical = bool(c.get("critical"))
        supports_final = bool(c.get("supports_final"))
        score = _claim_score(agg, critical=critical, supports_final=supports_final, params=params)
        # Weight reflects "importance" for aggregation.
        # Core chain claims get higher weight.
        weight = (
            params.weight_core_chain
            if (critical and supports_final)
            else (params.weight_critical if critical else (params.weight_supports_final if supports_final else params.weight_aux))
        )
        is_core = bool(critical or supports_final)

        if agg.status == "SUPPORTED":
            supported_count += 1
        elif agg.status == "REFUTED":
            refuted_count += 1
            if critical:
                critical_refuted += 1
            if supports_final:
                supports_final_refuted += 1
        else:
            uncertain_count += 1

        if agg.uncertain > 0.05:
            claims_with_any_uncertainty += 1
        if agg.refute > 0.05:
            claims_with_any_refute += 1

        support_mass_sum_all += agg.support * weight
        refute_mass_sum_all += agg.refute * weight
        uncertain_mass_sum_all += agg.uncertain * weight
        score_sum_all += score * weight
        weight_sum_all += weight

        if is_core:
            core_claims_total += 1
            support_mass_sum_core += agg.support * weight
            refute_mass_sum_core += agg.refute * weight
            uncertain_mass_sum_core += agg.uncertain * weight
            score_sum_core += score * weight
            weight_sum_core += weight
            if agg.uncertain > 0.05:
                core_claims_with_any_uncertainty += 1
            if agg.refute > 0.05:
                core_claims_with_any_refute += 1

            if agg.status == "REFUTED":
                core_claims_refuted += 1
            elif agg.status == "UNCERTAIN":
                core_claims_uncertain += 1
            else:
                if agg.uncertain <= params.fully_supported_uncertain_max and agg.refute <= params.fully_supported_refute_max:
                    core_claims_supported_fully += 1
                else:
                    core_claims_partially_supported += 1
        else:
            support_mass_sum_aux += agg.support * weight
            refute_mass_sum_aux += agg.refute * weight
            uncertain_mass_sum_aux += agg.uncertain * weight
            score_sum_aux += score * weight
            weight_sum_aux += weight

        per_claim[claim_id] = {
            "status": agg.status,
            "support": round(agg.support, 4),
            "refute": round(agg.refute, 4),
            "uncertain": round(agg.uncertain, 4),
            "score": round(score, 4),
            "critical": critical,
            "supports_final": supports_final,
            "is_core": bool(is_core),
            "has_uncertainty": bool(agg.uncertain > 0.05),
            "has_refute": bool(agg.refute > 0.05),
        }

    total = max(1, len(claims))
    # Main trust score is computed on CORE claims for stability/interpretability.
    core_trust_score = (score_sum_core / weight_sum_core) if weight_sum_core > 0 else 0.0
    overall_trust_score_raw = (score_sum_all / weight_sum_all) if weight_sum_all > 0 else core_trust_score

    aux_uncertain_mass_avg = (uncertain_mass_sum_aux / weight_sum_aux) if weight_sum_aux else 0.0
    aux_refute_mass_avg = (refute_mass_sum_aux / weight_sum_aux) if weight_sum_aux else 0.0
    # Auxiliary claims only mildly adjust the core score.
    aux_adjustment = 0.05 * aux_uncertain_mass_avg + 0.10 * aux_refute_mass_avg
    overall_trust_score = max(0.0, min(1.0, core_trust_score - aux_adjustment))

    diagnostics = {
        # Counts (derived from per-claim aggregated statuses)
        "supported": supported_count,
        "refuted": refuted_count,
        "uncertain": uncertain_count,
        "claims_with_any_uncertainty": claims_with_any_uncertainty,
        "claims_with_any_refute": claims_with_any_refute,
        "core_claims_total": core_claims_total,
        "core_claims_with_any_uncertainty": core_claims_with_any_uncertainty,
        "core_claims_with_any_refute": core_claims_with_any_refute,
        "core_claims_supported_fully": core_claims_supported_fully,
        "core_claims_partially_supported": core_claims_partially_supported,
        "core_claims_uncertain": core_claims_uncertain,
        "core_claims_refuted": core_claims_refuted,
        "supported_ratio": round(supported_count / total, 4),
        "refuted_ratio": round(refuted_count / total, 4),
        "uncertain_ratio": round(uncertain_count / total, 4),
        # Mass averages (explicitly incorporate support/uncertain/refute)
        "support_mass_avg": round((support_mass_sum_all / weight_sum_all) if weight_sum_all else 0.0, 4),
        "refute_mass_avg": round((refute_mass_sum_all / weight_sum_all) if weight_sum_all else 0.0, 4),
        "uncertain_mass_avg": round((uncertain_mass_sum_all / weight_sum_all) if weight_sum_all else 0.0, 4),
        "core_support_mass_avg": round((support_mass_sum_core / weight_sum_core) if weight_sum_core else 0.0, 4),
        "core_refute_mass_avg": round((refute_mass_sum_core / weight_sum_core) if weight_sum_core else 0.0, 4),
        "core_uncertain_mass_avg": round((uncertain_mass_sum_core / weight_sum_core) if weight_sum_core else 0.0, 4),
        "core_trust_score": round(core_trust_score, 4),
        "overall_trust_score": round(overall_trust_score, 4),
        "overall_trust_score_raw": round(overall_trust_score_raw, 4),
        "aux_uncertain_mass_avg": round(aux_uncertain_mass_avg, 4),
        "aux_refute_mass_avg": round(aux_refute_mass_avg, 4),
        "aux_adjustment": round(aux_adjustment, 4),
        "trust_score_all_claims": round((score_sum_all / weight_sum_all) if weight_sum_all else 0.0, 4),
        "primary_failure_modes": sorted(failure_mode_counts.items(), key=lambda kv: kv[1], reverse=True)[:5],
        "critical_refuted": critical_refuted,
        "supports_final_refuted": supports_final_refuted,
        "per_claim": per_claim,
    }

    # Keep top-level trust_score as core_trust_score (decision is core-first).
    return {"trust_score": round(core_trust_score, 4), "diagnostics": diagnostics}
