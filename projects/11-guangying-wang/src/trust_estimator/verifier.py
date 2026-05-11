from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .llm import LLMClient
from .schemas import verification_answer_schema, verification_questions_schema


_EN_STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "does",
    "do",
    "did",
    "most",
    "many",
    "typically",
    "often",
    "near",
    "roughly",
    "what",
    "how",
    "why",
    "when",
    "which",
    "it",
    "this",
    "that",
}


def _en_keywords(text: str) -> List[str]:
    toks = [t.lower() for t in re.findall(r"[A-Za-z]{3,}", text)]
    out: List[str] = []
    for t in toks:
        if t in _EN_STOPWORDS:
            continue
        out.append(t)
    # De-dup while preserving order
    seen = set()
    uniq: List[str] = []
    for t in out:
        if t in seen:
            continue
        seen.add(t)
        uniq.append(t)
    return uniq[:12]


def _zh_keywords(text: str) -> List[str]:
    # Very simple: keep CJK 2-4 char chunks to approximate key phrases.
    chunks = re.findall(r"[\u4e00-\u9fff]{2,6}", text)
    out: List[str] = []
    seen = set()
    for c in chunks:
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
    return out[:12]


def _required_terms(question: str, lang: str) -> List[str]:
    q = question.strip()
    ql = q.lower()
    required: List[str] = []

    # Canonicalize symbol/word variants so we don't double-count τ + "tau".
    if lang != "zh":
        if ("τ" in q) or ("relaxation time" in ql) or re.search(r"\btau\b", ql):
            required.append("tau")
        if ("μ" in q) or ("mobility" in ql) or re.search(r"\bmu\b", ql):
            required.append("mu")
        if ("ρ" in q) or ("resistivity" in ql) or re.search(r"\brho\b", ql):
            required.append("rho")
        if ("σ" in q) or ("conductivity" in ql) or re.search(r"\bsigma\b", ql):
            required.append("sigma")
        if ("ℓ" in q) or ("mean free path" in ql):
            required.append("mean_free_path")
        if ("v_F" in q) or ("fermi" in ql):
            required.append("v_F")
    else:
        # Keep symbolic variables in zh mode (users may ask with symbols).
        for sym in ["τ", "μ", "ρ", "σ", "ℓ", "v_F"]:
            if sym in q:
                required.append(sym)

    if lang == "zh":
        # Key domain terms: if asked, require presence in the answer.
        zh_terms = [
            ("\u58f0\u5b50", "\u58f0\u5b50"),
            ("\u6563\u5c04", "\u6563\u5c04"),
            ("\u5f1b\u8c6b\u65f6\u95f4", "\u5f1b\u8c6b"),
            ("\u8fc1\u79fb\u7387", "\u8fc1\u79fb\u7387"),
            ("\u7535\u5bfc\u7387", "\u7535\u5bfc\u7387"),
            ("\u7535\u963b\u7387", "\u7535\u963b\u7387"),
            ("\u5e73\u5747\u81ea\u7531\u7a0b", "\u81ea\u7531\u7a0b"),
            ("\u6676\u683c", "\u6676\u683c"),
        ]
        for needle, term in zh_terms:
            if needle in q:
                required.append(term)
        return required

    # English: add only non-symbol terms here (symbols handled above).
    en_rules = [
        (r"\bphonon", "phonon"),
        (r"\bscattering\b", "scattering"),
        (r"\blattice\b", "lattice"),
        (r"\barrhenius\b", "arrhenius"),
        (r"\bactivation energy\b|\bea\b", "ea"),
        (r"\bexponential\b", "exponential"),
    ]
    for pat, term in en_rules:
        if re.search(pat, ql):
            required.append(term)
    # De-dup while preserving order
    seen = set()
    out: List[str] = []
    for t in required:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def _required_coverage(required_terms: List[str], answer: str, lang: str) -> float:
    if not required_terms:
        return 1.0
    al = answer.lower()
    hits = 0
    synonyms = {
        "tau": ["tau", "τ", "relaxation time"],
        "mu": ["mobility", "μ", "mu"],
        "rho": ["resistivity", "ρ", "rho"],
        "sigma": ["conductivity", "σ", "sigma"],
        "mean_free_path": ["mean free path", "ℓ", "l"],
        "v_F": ["v_f", "v_f", "fermi"],
        "ea": ["ea", "e_a", "activation energy", "activation-energy"],
        "arrhenius": ["arrhenius"],
        "exponential": ["exponential", "exp("],
    }
    for t in required_terms:
        variants = synonyms.get(t, [t])
        if any((v in answer) or (v.lower() in al) for v in variants):
            hits += 1
    return hits / len(required_terms)


def _relevance_score(question: str, answer: str, lang: str) -> float:
    if not question.strip() or not answer.strip():
        return 0.0
    if lang == "zh":
        qk = _zh_keywords(question)
        ak = set(_zh_keywords(answer))
    else:
        qk = _en_keywords(question)
        ak = set(_en_keywords(answer))
    if not qk:
        return 0.0
    overlap = sum(1 for k in qk if k in ak)
    return overlap / max(1, len(qk))


def _text_similarity(a: str, b: str) -> float:
    # Token Jaccard similarity, used only to catch obvious repetition.
    at = set(re.findall(r"[A-Za-z]{3,}|[\u4e00-\u9fff]{2,6}", a.lower()))
    bt = set(re.findall(r"[A-Za-z]{3,}|[\u4e00-\u9fff]{2,6}", b.lower()))
    if not at or not bt:
        return 0.0
    return len(at & bt) / len(at | bt)


def _calculation_ok(question: str, answer: str, lang: str) -> bool:
    q = question.strip()
    a = answer.strip()
    if not q or not a:
        return False
    al = a.lower()
    ql = q.lower()

    # Must look like a calculation/formula OR a numeric result.
    looks_like_math = any(tok in a for tok in ["=", "≈", "sqrt", "√", "^"]) or bool(re.search(r"\d", a))
    if not looks_like_math:
        return False

    if lang == "zh":
        # If the question asks for t or v explicitly, require it or a unit.
        if ("t" in ql or "\u65f6\u95f4" in q) and not (("t" in al) or ("\u79d2" in a) or re.search(r"\d", a)):
            return False
        if ("v" in ql or "\u901f\u5ea6" in q) and not (("v" in al) or ("m/s" in al) or ("\u7c73/\u79d2" in a) or re.search(r"\d", a)):
            return False
        return True

    # English
    if re.search(r"\bt\b", ql) and ("t" not in al) and (" s" not in al) and not re.search(r"\d", a):
        return False
    if re.search(r"\bv\b", ql) and ("v" not in al) and ("m/s" not in al) and not re.search(r"\d", a):
        return False
    return True

def _relation_ok(question: str, answer: str, expected_answer_type: str, lang: str) -> bool:
    # For short_fact/yes_no questions, require a directional / relational token when asked.
    if expected_answer_type not in ("short_fact", "yes_no"):
        return True
    q = question.lower()
    a = answer.lower()

    if lang == "zh":
        # If the question asks for direction, require explicit direction words.
        if ("\u53d8\u5927" in question) or ("\u53d8\u5c0f" in question) or ("\u589e\u52a0" in question) or ("\u51cf\u5c0f" in question) or ("\u53d8\u5f3a" in question) or ("\u53d8\u5f31" in question) or ("\u6b63\u6bd4" in question) or ("\u53cd\u6bd4" in question):
            return any(
                w in answer
                for w in [
                    "\u53d8\u5927",
                    "\u53d8\u5c0f",
                    "\u589e\u52a0",
                    "\u51cf\u5c0f",
                    "\u53d8\u5f3a",
                    "\u53d8\u5f31",
                    "\u6b63\u6bd4",
                    "\u53cd\u6bd4",
                    "\u6210\u6b63\u6bd4",
                    "\u6210\u53cd\u6bd4",
                    "\u4e0a\u5347",
                    "\u4e0b\u964d",
                ]
            )
        return True

    # English
    if ("increase or decrease" in q) or ("increase" in q and "decrease" in q):
        return ("increase" in a) or ("decrease" in a)
    if "proportional" in q or "inversely" in q:
        return ("proportional" in a) or ("inverse" in a) or ("inversely" in a)
    # Default: require at least one relational cue.
    return any(w in a for w in ["increase", "decrease", "proportional", "inverse", "inversely", "larger", "smaller"])


def _relation_expected(question: str, lang: str) -> bool:
    if lang == "zh":
        return ("\u6b63\u6bd4" in question) or ("\u53cd\u6bd4" in question) or ("\u6210\u6b63\u6bd4" in question) or ("\u6210\u53cd\u6bd4" in question)
    ql = question.lower()
    return ("proportional" in ql) or ("inversely" in ql) or ("inverse" in ql)


def _direction_expected(question: str, lang: str) -> bool:
    if lang == "zh":
        return any(w in question for w in ["\u53d8\u5927", "\u53d8\u5c0f", "\u589e\u52a0", "\u51cf\u5c0f", "\u53d8\u5f3a", "\u53d8\u5f31", "\u4e0a\u5347", "\u4e0b\u964d", "\u662f", "\u5426"])
    ql = question.lower()
    return ("increase" in ql and "decrease" in ql) or ("increase or decrease" in ql) or ("yes" in ql and "no" in ql)


def _direction_ok(question: str, answer: str, lang: str) -> bool:
    if not _direction_expected(question, lang):
        return True
    if lang == "zh":
        return any(w in answer for w in ["\u53d8\u5927", "\u53d8\u5c0f", "\u589e\u52a0", "\u51cf\u5c0f", "\u53d8\u5f3a", "\u53d8\u5f31", "\u4e0a\u5347", "\u4e0b\u964d", "\u662f", "\u5426"])
    al = answer.lower()
    return any(w in al for w in ["increase", "decrease", "yes", "no"])


def _binary_expected(question: str, expected_answer_type: str, lang: str) -> bool:
    if expected_answer_type == "yes_no":
        return True
    q = question.strip()
    ql = q.lower()
    if lang == "zh":
        return ("\u662f/\u5426" in q) or ("\u56de\u7b54\u662f/\u5426" in q) or ("\u662f" in q and "\u5426" in q)
    return ("yes/no" in ql) or ("answer yes/no" in ql) or ("yes" in ql and "no" in ql)


def _binary_decision_detected(answer: str, lang: str) -> bool:
    a = answer.strip()
    if not a:
        return False
    if lang == "zh":
        return a.startswith(("\u662f", "\u5426")) or ("\u662f" in a[:6]) or ("\u5426" in a[:6])
    al = a.lower().strip()
    return al.startswith(("yes", "no")) or bool(re.match(r"^(yes|no)\\b", al))


def _is_minimal_binary_answer(answer: str, lang: str) -> bool:
    a = answer.strip()
    if not a:
        return False
    if lang == "zh":
        return a in ("\u662f", "\u5426", "\u662f\u3002", "\u5426\u3002")
    al = a.lower()
    return al in ("yes", "no", "yes.", "no.")


def _directional_answer_detected(answer: str, lang: str) -> bool:
    a = answer.strip()
    if not a:
        return False
    if lang == "zh":
        return any(w in a[:12] for w in ["\u589e\u52a0", "\u51cf\u5c0f", "\u53d8\u5927", "\u53d8\u5c0f", "\u53d8\u5f3a", "\u53d8\u5f31", "\u4e0a\u5347", "\u4e0b\u964d"])
    al = a.lower()
    return any(w in al[:28] for w in ["increase", "decrease", "higher", "lower"])


def _relation_answer_detected(answer: str, lang: str) -> bool:
    a = answer.strip()
    if not a:
        return False
    if lang == "zh":
        return ("\u6b63\u6bd4" in a) or ("\u53cd\u6bd4" in a) or ("\u6210\u6b63\u6bd4" in a) or ("\u6210\u53cd\u6bd4" in a)
    al = a.lower()
    return ("proportional" in al) or ("inversely" in al) or ("inverse" in al)


def _short_fact_prefix_ok(answer: str, lang: str) -> bool:
    a = answer.strip()
    if not a:
        return False
    if lang == "zh":
        prefixes = ("\u589e\u52a0", "\u51cf\u5c0f", "\u53d8\u5927", "\u53d8\u5c0f", "\u53d8\u5f3a", "\u53d8\u5f31", "\u662f", "\u5426", "\u6b63\u6bd4", "\u53cd\u6bd4", "\u4e0d\u786e\u5b9a")
        return a.startswith(prefixes)
    prefixes = (
        "Increase",
        "Decrease",
        "Yes",
        "No",
        "Proportional",
        "Inversely proportional",
        "Stronger",
        "Weaker",
        "Uncertain",
    )
    return any(a.startswith(p) for p in prefixes)


def _first_sentence(text: str, lang: str) -> str:
    t = text.strip()
    if not t:
        return ""
    if lang == "zh":
        for sep in ["\u3002", "\n", "\uff01", "\uff1f"]:
            if sep in t:
                return t.split(sep, 1)[0].strip()
        return t
    for sep in [".", "\n", "!", "?"]:
        if sep in t:
            return t.split(sep, 1)[0].strip()
    return t


def _short_fact_has_direction_in_first_sentence(answer: str, lang: str) -> bool:
    s = _first_sentence(answer, lang).strip()
    if not s:
        return False
    if lang == "zh":
        return any(w in s for w in ["\u589e\u52a0", "\u51cf\u5c0f", "\u53d8\u5927", "\u53d8\u5c0f", "\u53d8\u5f3a", "\u53d8\u5f31", "\u662f", "\u5426", "\u6b63\u6bd4", "\u53cd\u6bd4", "\u4e0d\u786e\u5b9a", "\u4e0a\u5347", "\u4e0b\u964d"])
    sl = s.lower()
    return any(
        w in sl
        for w in [
            "increase",
            "decrease",
            "yes",
            "no",
            "proportional",
            "inversely",
            "uncertain",
            "stronger",
            "weaker",
            "higher",
            "lower",
        ]
    )

def _focus_hints(*, claim_text: str, lang: str) -> str:
    ct = claim_text.lower()
    if lang == "zh":
        if ("\u58f0\u5b50" in claim_text) or ("\u7535\u5b50-\u58f0\u5b50" in claim_text) or ("electron" in ct and "phonon" in ct):
            return (
                "\u8be5 claim \u5173\u6ce8\uff1a\u6e29\u5ea6\u5347\u9ad8 → \u58f0\u5b50/\u6676\u683c\u70ed\u632f\u52a8\u589e\u5f3a → \u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u589e\u5f3a\u3002\n"
                "\u95ee\u9898\u5fc5\u987b\u5206\u522b\u8986\u76d6\uff1a\n"
                "- \u58f0\u5b50\u5360\u636e\u6570/\u6676\u683c\u632f\u52a8\u4e0e\u6e29\u5ea6\u7684\u5173\u7cfb\n"
                "- \u6563\u5c04\u7387/\u5f1b\u8c6b\u65f6\u95f4\u968f\u6e29\u5ea6\u53d8\u5316\u7684\u65b9\u5411\uff08\u5728\u91d1\u5c5e\u4e2d\uff09\n"
                "\u907f\u514d\u95ee Drude \u516c\u5f0f\u6216 μ/σ/ρ \u7684\u4ee3\u6570\u5173\u7cfb\uff08\u90a3\u5c5e\u4e8e\u53e6\u4e00\u7c7b claim\uff09\u3002"
            )
        if ("drude" in ct) or ("\u8fc1\u79fb\u7387" in claim_text) or ("\u8f7d\u6d41\u5b50" in claim_text) or ("mobility" in ct):
            return (
                "\u8be5 claim \u5173\u6ce8\uff1aDrude \u6a21\u578b\u4e0b scattering/τ\u3001mobility μ\u3001conductivity σ\u3001resistivity ρ \u7684\u5173\u7cfb\u3002\n"
                "\u95ee\u9898\u5fc5\u987b\u5206\u522b\u8986\u76d6\uff1a\n"
                "- σ\u3001ρ \u4e0e n\u3001μ\uff08\u6216 τ\uff09\u7684\u516c\u5f0f\u5173\u7cfb\n"
                "- scattering/τ \u5982\u4f55\u5f71\u54cd μ\n"
                "\u907f\u514d\u628a\u95ee\u9898\u5199\u6210“\u6e29\u5ea6\u5347\u9ad8→\u58f0\u5b50\u589e\u52a0”\u8fd9\u7c7b phonon \u673a\u5236\uff08\u90a3\u5c5e\u4e8e\u53e6\u4e00\u6761 claim\uff09\u3002"
            )
        return "\u95ee\u9898\u5fc5\u987b\u7d27\u8d34\u8be5 claim \u7684\u5177\u4f53\u5185\u5bb9\uff0c\u907f\u514d\u6cdb\u5316\u5230\u522b\u7684 claim\u3002"

    # English
    if ("phonon" in ct) or ("electron-phonon" in ct) or ("electron–phonon" in ct):
        return (
            "This claim is about: higher temperature → more phonons/lattice vibrations → stronger electron–phonon scattering.\n"
            "Your questions MUST separately cover:\n"
            "- phonon population / lattice vibration vs. temperature\n"
            "- scattering rate / relaxation time vs. temperature (in metals)\n"
            "Avoid Drude algebra (σ/ρ vs n, μ, τ); that belongs to a different claim."
        )
    if ("drude" in ct) or ("mobility" in ct) or ("carrier density" in ct) or ("τ" in claim_text):
        return (
            "This claim is about the Drude relationships among scattering/τ, mobility μ, conductivity σ, and resistivity ρ.\n"
            "Your questions MUST separately cover:\n"
            "- the formulas linking σ, ρ with n, μ (or τ)\n"
            "- how scattering/τ affects μ\n"
            "Avoid phonon-mechanism questions; those belong to a different claim."
        )
    return "Questions must be tightly claim-specific; avoid generic prompts."


def _rule_based_questions(
    *,
    claim_id: str,
    claim_text: str,
    per_claim_questions: int,
    lang: str,
) -> List[Dict[str, str]] | None:
    ct = claim_text.lower()

    def pack(items: List[tuple[str, str, str]]) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []
        for i, (qid, q, t) in enumerate(items[:per_claim_questions]):
            out.append({"question_id": f"{claim_id}_Q{i+1}", "question": q, "expected_answer_type": t})
        return out

    # Fact: metal resistivity vs temperature near room temperature (C1-like)
    if (
        ("resistivity" in ct or "resistance" in ct)
        and ("temperature" in ct or "room temperature" in ct)
        and ("linear" in ct or "approximately" in ct or "increase" in ct)
    ) or (("\u7535\u963b\u7387" in claim_text or "\u7535\u963b" in claim_text) and ("\u6e29\u5ea6" in claim_text) and ("\u7ebf\u6027" in claim_text or "\u589e\u5927" in claim_text)):
        if lang == "zh":
            return pack(
                [
                    ("Q1", "\u5728\u5ba4\u6e29\u9644\u8fd1\uff0c\u591a\u6570\u91d1\u5c5e\u7535\u963b\u7387\u968f\u6e29\u5ea6\u5347\u9ad8\u901a\u5e38\u662f\u589e\u5927\u8fd8\u662f\u51cf\u5c0f\uff1f", "short_fact"),
                    ("Q2", "\u5728\u5ba4\u6e29\u9644\u8fd1\uff0c\u91d1\u5c5e\u7535\u963b\u7387-\u6e29\u5ea6\u5173\u7cfb\u5e38\u53ef\u8fd1\u4f3c\u4e3a\u7ebf\u6027\u5417\uff1f\uff08\u662f/\u5426\uff09", "short_fact"),
                    ("Q3", "\u5728\u4f4e\u6e29\uff08\u5982\u6db2\u6c26\u6e29\u533a\uff09\uff0c\u7535\u963b\u7387-\u6e29\u5ea6\u5173\u7cfb\u901a\u5e38\u6bd4\u5ba4\u6e29\u9644\u8fd1\u66f4\u4e0d\u7ebf\u6027\u5417\uff1f\uff08\u662f/\u5426\uff09", "short_fact"),
                    ("Q4", "\u5728\u5ba4\u6e29\u9644\u8fd1\uff0c\u591a\u6570\u91d1\u5c5e\u7684\u6e29\u5ea6\u7cfb\u6570\uff08dρ/dT\uff09\u7684\u7b26\u53f7\u901a\u5e38\u4e3a\u6b63\u8fd8\u662f\u4e3a\u8d1f\uff1f", "short_fact"),
                ]
            )
        return pack(
            [
                ("Q1", "Near room temperature, for most metals does resistivity increase or decrease as temperature increases?", "short_fact"),
                ("Q2", "Near room temperature, is resistivity vs. temperature often approximated as roughly linear? (Answer yes/no.)", "short_fact"),
                ("Q3", "At cryogenic temperatures, is the resistivity–temperature relationship typically less linear than near room temperature? (Answer yes/no.)", "short_fact"),
                ("Q4", "Near room temperature, is the temperature coefficient of resistivity (dρ/dT) usually positive for metals? (Answer yes/no.)", "short_fact"),
            ]
        )

    # Mechanism: phonons / electron-phonon scattering (C2-like)
    if ("phonon" in ct) or ("electron-phonon" in ct) or ("electron–phonon" in ct) or ("\u58f0\u5b50" in claim_text) or ("\u7535\u5b50-\u58f0\u5b50" in claim_text):
        if lang == "zh":
            return pack(
                [
                    # Atomic: T -> phonon
                    ("Q1", "\u6e29\u5ea6\u5347\u9ad8\u65f6\uff0c\u58f0\u5b50\u5360\u636e\u6570\uff08\u6216\u6676\u683c\u70ed\u632f\u52a8\u5f3a\u5ea6\uff09\u901a\u5e38\u5982\u4f55\u53d8\u5316\uff1f", "short_fact"),
                    # Atomic: phonon -> scattering
                    ("Q2", "\u5728\u91d1\u5c5e\u4e2d\uff0c\u58f0\u5b50\u6570\u589e\u52a0\u4f1a\u5982\u4f55\u5f71\u54cd\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u5f3a\u5ea6/\u6563\u5c04\u7387\uff1f", "short_fact"),
                    # Atomic: T -> scattering (direction / regime)
                    ("Q3", "\u5728\u5ba4\u6e29\u9644\u8fd1\uff0c\u6e29\u5ea6\u5347\u9ad8\u901a\u5e38\u4f1a\u8ba9\u7535\u5b50-\u58f0\u5b50\u6563\u5c04\u53d8\u5f3a\u8fd8\u662f\u53d8\u5f31\uff1f", "short_fact"),
                    # Optional discriminator (still single relation)
                    ("Q4", "\u7528\u4e00\u53e5\u8bdd\u8bf4\u660e\uff1a\u4e3a\u4ec0\u4e48\u66f4\u591a\u58f0\u5b50\u610f\u5473\u7740\u66f4\u591a\u53ef\u7528\u7684\u6563\u5c04\u901a\u9053\uff1f", "short_fact"),
                ]
            )
        return pack(
            [
                # Atomic: T -> phonon
                ("Q1", "As temperature increases, how do phonon populations (lattice vibrations) typically change?", "short_fact"),
                # Atomic: phonon -> scattering
                ("Q2", "In a metal, if phonon population increases, does electron–phonon scattering generally increase or decrease?", "short_fact"),
                # Atomic: T -> scattering
                ("Q3", "Near room temperature, does raising temperature tend to increase or decrease electron–phonon scattering?", "short_fact"),
                # Optional: causal link, still single step
                ("Q4", "In one sentence: why do more phonons generally imply more scattering channels?", "short_fact"),
            ]
        )

    # Mechanism: Drude relationships (C3-like)
    if ("drude" in ct) or ("mobility" in ct) or ("relaxation" in ct) or ("\u8fc1\u79fb\u7387" in claim_text) or ("\u5f1b\u8c6b" in claim_text) or ("\u8f7d\u6d41\u5b50" in claim_text):
        if lang == "zh":
            return pack(
                [
                    # Atomic: scattering -> tau
                    ("Q1", "\u6563\u5c04\u589e\u5f3a\u65f6\uff0c\u5f1b\u8c6b\u65f6\u95f4 τ \u901a\u5e38\u53d8\u5927\u8fd8\u662f\u53d8\u5c0f\uff1f", "short_fact"),
                    # Atomic: tau -> mobility
                    ("Q2", "\u5728 Drude \u6a21\u578b\u4e2d\uff0cτ \u53d8\u5c0f\u4f1a\u8ba9\u8fc1\u79fb\u7387 μ \u53d8\u5927\u8fd8\u662f\u53d8\u5c0f\uff1f", "short_fact"),
                    # Atomic: mobility -> resistivity
                    ("Q3", "\u5728 n \u8fd1\u4f3c\u4e0d\u53d8\u65f6\uff0c\u8fc1\u79fb\u7387 μ \u53d8\u5c0f\u4f1a\u8ba9\u7535\u963b\u7387 ρ \u53d8\u5927\u8fd8\u662f\u53d8\u5c0f\uff1f", "short_fact"),
                    # Atomic: formula check
                    ("Q4", "\u5199\u51fa Drude \u6a21\u578b\u4e2d σ \u4e0e n\u3001e\u3001μ \u7684\u5173\u7cfb\u5f0f\uff08\u6216\u5199\u51fa ρ \u4e0e\u8fd9\u4e9b\u91cf\u7684\u5173\u7cfb\uff09\u3002", "calculation"),
                ]
            )
        return pack(
            [
                # Atomic: scattering -> tau
                ("Q1", "If scattering becomes stronger, does the relaxation time τ generally increase or decrease?", "short_fact"),
                # Atomic: tau -> mobility
                ("Q2", "In the Drude model, if τ decreases, does mobility μ increase or decrease?", "short_fact"),
                # Atomic: mobility -> resistivity (given n ~ const)
                ("Q3", "Assuming carrier density n is roughly constant, if μ decreases, does resistivity ρ increase or decrease?", "short_fact"),
                # Atomic: formula check
                ("Q4", "Write the Drude relation linking σ (or ρ) to n, e, and μ (or τ).", "calculation"),
            ]
        )

    return None


def _generate_verification_questions(
    llm: LLMClient,
    *,
    question: str,
    claim_id: str,
    claim_text: str,
    per_claim_questions: int,
    lang: str,
) -> List[Dict[str, str]]:
    rb = _rule_based_questions(
        claim_id=claim_id, claim_text=claim_text, per_claim_questions=per_claim_questions, lang=lang
    )
    if rb:
        return rb[:per_claim_questions]

    if lang == "zh":
        system = (
            "\u4f60\u9700\u8981\u4e3a\u4e00\u4e2a\u7ed9\u5b9a claim \u751f\u6210\u9a8c\u8bc1\u95ee\u9898\uff082-4 \u4e2a\uff09\uff0c\u7528\u4e8e\u68c0\u67e5\u8be5 claim \u662f\u5426\u6210\u7acb\u3002\n"
            "\u9a8c\u8bc1\u95ee\u9898\u5e94\u80fd\u72ec\u7acb\u4f5c\u7b54\uff0c\u4e0d\u8981\u76f4\u63a5\u590d\u8ff0\u6216\u8fd1\u4f3c\u6539\u5199 claim \u539f\u53e5\u3002\n"
            "\u95ee\u9898\u5fc5\u987b\u7d27\u8d34\u8be5 claim \u7684\u5177\u4f53\u5185\u5bb9\uff08claim-specific\uff09\uff0c\u907f\u514d\u5bf9\u6240\u6709 claim \u90fd\u901a\u7528\u7684\u6cdb\u5316\u95ee\u9898\u3002\n"
            "\u4f18\u5148\u9009\u62e9\u80fd\u66b4\u9732\u77db\u76fe/\u8fb9\u754c\u6761\u4ef6/\u5b9a\u4e49\u9519\u8bef/\u673a\u5236\u9519\u8bef/\u7b80\u5355\u7b97\u9519\u7684\u95ee\u9898\uff1b\u6bcf\u4e2a\u95ee\u9898\u5173\u6ce8\u4e0d\u540c\u89d2\u5ea6\u3002\n"
            "\u8bf7\u7528\u4e2d\u6587\u5199\u95ee\u9898\u3002\n"
            "\u8f93\u51fa\u5fc5\u987b\u4e25\u683c\u7b26\u5408\u7ed9\u5b9a JSON schema\u3002"
        )
        tail = f"\n\n\u8bf7\u751f\u6210\u6070\u597d {per_claim_questions} \u4e2a\u9a8c\u8bc1\u95ee\u9898\u3002"
    else:
        system = (
            "Generate verification questions (2-4) to check whether a specific claim is correct.\n"
            "Questions must be answerable independently, and should not quote or paraphrase the claim verbatim.\n"
            "Questions must be claim-specific (avoid generic questions that would apply to many unrelated claims).\n"
            "Prefer questions that would expose contradictions (edge cases, definitions, mechanisms, simple calculations), and make each question probe a distinct aspect.\n"
            "Write the questions in English.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
        tail = f"\n\nGenerate exactly {per_claim_questions} verification questions."

    messages = [
        (
            "system",
            system,
        ),
        (
            "user",
            "MAIN_QUESTION:\n"
            + question
            + "\n\nCLAIM_ID: "
            + claim_id
            + "\nCLAIM_TEXT:\n"
            + claim_text
            + "\n\nFOCUS_HINTS:\n"
            + _focus_hints(claim_text=claim_text, lang=lang)
            + tail,
        ),
    ]

    schema = verification_questions_schema(per_claim_questions=per_claim_questions)
    data = llm.structured(messages=messages, schema=schema)
    return data["questions"][:per_claim_questions]


def _answer_verification_question(
    llm: LLMClient,
    *,
    main_question: str,
    verification_question: str,
    expected_answer_type: str,
    claim_text: str,
    lang: str,
) -> Dict[str, Any]:
    if lang == "zh":
        system = (
            "\u8bf7\u72ec\u7acb\u56de\u7b54\u9a8c\u8bc1\u95ee\u9898\u3002\n"
            "\u4e0d\u8981\u5f15\u7528\u6216\u590d\u8ff0\u4efb\u4f55“\u8349\u7a3f\u56de\u7b54”\u7684\u63aa\u8f9e\u3002\n"
            "\u8981\u6c42\uff1a\u5148\u76f4\u63a5\u56de\u7b54\u8be5\u95ee\u9898\u672c\u8eab\uff08\u4e0d\u8981\u8dd1\u9898\uff09\uff0c\u518d\u7ed9\u51fa\u4e00\u53e5\u7b80\u77ed\u7406\u7531\u3002\n"
            "\u4e0d\u8981\u590d\u8bfb\u4e0a\u4e00\u95ee\u7684\u7b54\u6848\uff1b\u4e0d\u8981\u6cdb\u6cdb\u590d\u8ff0 claim \u539f\u53e5\u3002\n"
            "\u8bf7\u5c3d\u91cf\u7b80\u6d01\uff1ashort_fact/yes_no \u53ef 1-2 \u53e5\uff0c\u5176\u5b83 2-3 \u53e5\u3002\n"
            "\u5fc5\u987b\u8986\u76d6\u95ee\u9898\u4e2d\u7684\u5173\u952e\u53d8\u91cf/\u5173\u952e\u8bcd\uff08\u4f8b\u5982 τ\u3001μ\u3001ρ\u3001σ\u3001\u58f0\u5b50\u3001\u6563\u5c04 \u7b49\uff09\u3002\n"
            "\u5982\u679c expected_answer_type \u662f short_fact \u6216 yes_no\uff1a\u7b2c\u4e00\u53e5\u5fc5\u987b\u7528\u975e\u5e38\u77ed\u4e14\u660e\u786e\u7684\u7ed3\u8bba\u8bcd\u5f00\u5934\uff08\u4f8b\u5982\uff1a\u589e\u52a0/\u51cf\u5c0f/\u53d8\u5927/\u53d8\u5c0f/\u662f/\u5426/\u6b63\u6bd4/\u53cd\u6bd4/\u4e0d\u786e\u5b9a\uff09\uff0c\u5141\u8bb8\u53ea\u8f93\u51fa\u5355\u8bcd/\u77ed\u8bed\uff08\u5982“\u5426\u3002”\uff09\uff0c\u7136\u540e\u53ef\u9009\u8865\u4e00\u53e5\u89e3\u91ca\u3002\n"
            "\u56de\u7b54\u540e\uff0c\u518d\u5224\u65ad\uff1a\u4f60\u7684\u56de\u7b54\u5bf9\u7ed9\u5b9a claim \u7684\u5173\u7cfb\u662f SUPPORTS / REFUTES / UNCERTAIN\u3002\n"
            "\u82e5\u4fe1\u606f\u4e0d\u8db3\u6216\u9886\u57df\u4e0d\u786e\u5b9a\uff0c\u8bf7\u9009 UNCERTAIN\u3002\n"
            "\u8bf7\u7528\u4e2d\u6587\u4f5c\u7b54\u4e0e\u8bf4\u660e\u3002\n"
            "\u8f93\u51fa\u5fc5\u987b\u4e25\u683c\u7b26\u5408\u7ed9\u5b9a JSON schema\u3002"
        )
    else:
        system = (
            "Answer the verification question independently.\n"
            "Do NOT reference or quote any prior draft answer.\n"
            "Requirement: answer THIS question directly (no tangents), then give a brief rationale.\n"
            "Do NOT repeat the previous answer; do NOT vaguely restate the claim.\n"
            "Be concise: for short_fact/yes_no, 1-2 sentences is OK; otherwise 2-3 sentences.\n"
            "You MUST mention the key variables/keywords from the question (e.g., τ, mobility, resistivity, conductivity, phonon, scattering).\n"
            "If expected_answer_type is short_fact or yes_no: the FIRST sentence MUST start with a crisp token like: Increase., Decrease., Yes., No., Proportional., Inversely proportional., or Uncertain. A single-word/phrase answer (e.g., \"No.\") is allowed; optionally add one brief sentence of explanation.\n"
            "Then judge whether YOUR answer supports or refutes the provided claim.\n"
            "If insufficient info or domain uncertainty, mark UNCERTAIN.\n"
            "Answer in English.\n"
            "Output MUST strictly follow the provided JSON schema."
        )
    messages = [
        (
            "system",
            system,
        ),
        (
            "user",
            "MAIN_QUESTION:\n"
            + main_question
            + "\n\nVERIFICATION_QUESTION:\n"
            + verification_question
            + "\n\nEXPECTED_ANSWER_TYPE:\n"
            + expected_answer_type
            + "\n\nCLAIM_TO_EVALUATE:\n"
            + claim_text,
        ),
    ]
    schema = verification_answer_schema()
    return llm.structured(messages=messages, schema=schema)


def verify_claims(
    llm: LLMClient,
    *,
    question: str,
    draft_answer: str,
    claims: List[Dict[str, Any]],
    per_claim_questions: int = 3,
    lang: str = "en",
) -> Dict[str, Any]:
    verification_questions: Dict[str, List[Dict[str, str]]] = {}
    verification_answers: Dict[str, List[Dict[str, Any]]] = {}

    for c in claims:
        claim_id = c["claim_id"]
        claim_text = c["text"]

        qs = _generate_verification_questions(
            llm,
            question=question,
            claim_id=claim_id,
            claim_text=claim_text,
            per_claim_questions=per_claim_questions,
            lang=lang,
        )
        verification_questions[claim_id] = qs

        answers: List[Dict[str, Any]] = []
        for q in qs:
            expected_type = q["expected_answer_type"]
            ans = _answer_verification_question(
                llm,
                main_question=question,
                verification_question=q["question"],
                expected_answer_type=expected_type,
                claim_text=claim_text,
                lang=lang,
            )
            relevance = _relevance_score(q["question"], ans.get("answer", ""), lang)
            required_terms = _required_terms(q["question"], lang)
            req_cov = _required_coverage(required_terms, ans.get("answer", ""), lang)

            binary_expected = _binary_expected(q["question"], expected_type, lang)
            binary_decision_detected = _binary_decision_detected(ans.get("answer", ""), lang)
            directional_answer_detected = _directional_answer_detected(ans.get("answer", ""), lang)
            relation_answer_detected = _relation_answer_detected(ans.get("answer", ""), lang)

            # Answer-type-aware check: for binary/directional questions, accept very short answers
            # like "No." / "Increase." without forcing keyword overlap.
            answer_type_check_passed = True
            if expected_type == "yes_no":
                answer_type_check_passed = bool(binary_decision_detected or directional_answer_detected)
            elif expected_type == "short_fact":
                if binary_expected and not (binary_decision_detected or directional_answer_detected):
                    answer_type_check_passed = False
                elif _direction_expected(q["question"], lang) and not (binary_decision_detected or directional_answer_detected):
                    answer_type_check_passed = False
                elif _relation_expected(q["question"], lang) and not relation_answer_detected:
                    answer_type_check_passed = False

            # Repetition check within the same claim
            repeated = False
            if answers and expected_type != "calculation":
                for prev_item in answers[-3:]:
                    prev = prev_item.get("answer", "")
                    if (
                        expected_type == "yes_no"
                        and prev_item.get("expected_answer_type") == "yes_no"
                        and _is_minimal_binary_answer(prev, lang)
                        and _is_minimal_binary_answer(ans.get("answer", ""), lang)
                    ):
                        # Allow repeated "Yes./No." across distinct yes/no questions.
                        continue
                    if _text_similarity(prev, ans.get("answer", "")) >= 0.85:
                        repeated = True
                        break

            stance = ans["stance_wrt_claim"]
            confidence = float(ans["confidence"])
            rationale = ans["rationale_brief"]

            failure_reason: Optional[str] = None
            soft_flags: List[str] = []
            if repeated:
                failure_reason = "repeated_answer"
            elif expected_type == "calculation" and not _calculation_ok(q["question"], ans.get("answer", ""), lang):
                failure_reason = "missing_required_calculation"
            elif expected_type in ("short_fact", "yes_no"):
                # Hard answer-type gates come BEFORE keyword overlap/required term checks
                # to avoid false UNCERTAIN for correct, minimal answers like "No.".
                if expected_type == "yes_no" and not binary_decision_detected:
                    failure_reason = "missing_binary_decision"
                    relevance = min(relevance, 0.05)
                elif expected_type == "yes_no" and not _short_fact_has_direction_in_first_sentence(ans.get("answer", ""), lang):
                    failure_reason = "missing_binary_decision"
                    relevance = min(relevance, 0.05)
                elif (
                    expected_type == "short_fact"
                    and (binary_expected or _direction_expected(q["question"], lang) or _relation_expected(q["question"], lang))
                    and not _short_fact_has_direction_in_first_sentence(ans.get("answer", ""), lang)
                ):
                    failure_reason = "missing_directional_answer"
                    relevance = min(relevance, 0.05)
                elif not _direction_ok(q["question"], ans.get("answer", ""), lang):
                    failure_reason = "missing_directional_answer"
                    relevance = min(relevance, 0.05)
                elif _relation_expected(q["question"], lang) and not _relation_ok(
                    q["question"], ans.get("answer", ""), expected_type, lang
                ):
                    failure_reason = "missing_required_relation"
                else:
                    # Soft checks (do not force stance=UNCERTAIN if the answer clearly gives a stance).
                    if expected_type != "yes_no" and required_terms and req_cov < 0.34:
                        soft_flags.append("missing_required_terms_soft")
                        confidence = max(0.0, confidence * 0.9)
                    if relevance < 0.12:
                        if expected_type == "yes_no" and binary_decision_detected:
                            # For yes/no questions, a clear binary stance like "No." is acceptable even with low keyword overlap.
                            pass
                        elif answer_type_check_passed:
                            soft_flags.append("low_keyword_coverage_soft")
                            confidence = max(0.0, confidence * 0.92)
                        else:
                            failure_reason = "low_keyword_coverage"
            else:
                # explanation/definition: keep stricter relevance/coverage
                if required_terms and req_cov < 0.5:
                    failure_reason = "missing_required_terms"
                elif relevance < 0.12:
                    failure_reason = "low_keyword_coverage"

            # Simple, non-LLM relevance gating.
            if failure_reason is not None:
                stance = "UNCERTAIN"
                confidence = min(confidence, 0.35)
                rationale = f"[relevance_check:{failure_reason}] {rationale}"

            answers.append(
                {
                    "question_id": q["question_id"],
                    "question": q["question"],
                    "expected_answer_type": expected_type,
                    "answer": ans["answer"],
                    "stance_wrt_claim": stance,
                    "confidence": confidence,
                    "rationale_brief": rationale,
                    "relevance": round(relevance, 4),
                    "required_terms": required_terms,
                    "required_coverage": round(req_cov, 4),
                    "relevance_check_failure_reason": failure_reason,
                    "answer_type_check_passed": bool(answer_type_check_passed),
                    "binary_decision_detected": bool(binary_decision_detected),
                    "directional_answer_detected": bool(directional_answer_detected),
                    "relation_answer_detected": bool(relation_answer_detected),
                    "answer_type_soft_flags": soft_flags,
                }
            )
        verification_answers[claim_id] = answers

    return {
        "verification_questions": verification_questions,
        "verification_answers": verification_answers,
    }
