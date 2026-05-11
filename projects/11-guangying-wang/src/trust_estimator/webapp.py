from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from .checker import check_trust
from .claim_extractor import extract_claims
from .decision import decide_with_reason
from .generator import generate_draft_answer
from .lang import normalize_lang
from .llm import LLMClient, LLMConfig, TemplateMismatchError
from .verifier import verify_claims


WEB_DIR = Path(__file__).resolve().parent.parent / "web"


class EstimateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)
    lang: Literal["auto", "zh", "en"] = "auto"
    mock: bool = False

    model: str = "gpt-4o"
    temperature: float = 0.2
    max_output_tokens: int = 900
    reasoning_effort: Optional[str] = None

    max_claims: int = 8
    per_claim_questions: int = Field(3, ge=2, le=4)


class EstimateResponse(BaseModel):
    question: str
    draft_answer: str
    extracted_claims: list[dict[str, Any]]
    verification_questions: dict[str, list[dict[str, Any]]]
    verification_answers: dict[str, list[dict[str, Any]]]
    trust_score: float
    decision: str
    diagnostics: dict[str, Any]


app = FastAPI(title="LLM Detector (claim-level verification)", version="0.1.0")

# Dev-friendly CORS so the widget can be embedded on arbitrary pages during local testing.
# For production, replace `allow_origins=["*"]` with an allowlist.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(index_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>Missing web/index.html</h1>", status_code=500)


@app.get("/widget.js")
def widget_js() -> FileResponse:
    p = WEB_DIR / "widget.js"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Missing web/widget.js")
    return FileResponse(str(p), media_type="text/javascript; charset=utf-8")


@app.post("/api/estimate", response_model=EstimateResponse)
def estimate(req: EstimateRequest) -> Dict[str, Any]:
    t0 = time.time()
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Empty question.")

    lang = normalize_lang(req.lang, question)
    llm = LLMClient(
        mock=req.mock,
        config=LLMConfig(
            model=req.model,
            temperature=req.temperature,
            max_output_tokens=req.max_output_tokens,
            reasoning_effort=req.reasoning_effort,
        ),
    )

    try:
        draft = generate_draft_answer(llm, question, lang=lang)
        claims = extract_claims(llm, question, draft["draft_answer"], max_claims=req.max_claims, lang=lang)
        verification = verify_claims(
            llm,
            question=question,
            draft_answer=draft["draft_answer"],
            claims=claims,
            per_claim_questions=req.per_claim_questions,
            lang=lang,
        )
        trust = check_trust(claims, verification["verification_answers"])
        decision, decision_reason, core_failure_summary = decide_with_reason(trust)
        trust["diagnostics"]["decision_reason"] = decision_reason
        trust["diagnostics"]["core_failure_summary"] = core_failure_summary
        trust["diagnostics"]["latency_s"] = round(time.time() - t0, 4)
    except TemplateMismatchError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "TEMPLATE_MISMATCH",
                "message": str(e),
                "detected_topic": e.detected_topic,
                "supported_topics": e.supported_topics,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"estimate_failed: {type(e).__name__}: {e}")

    return {
        "question": question,
        "draft_answer": draft["draft_answer"],
        "extracted_claims": claims,
        "verification_questions": verification["verification_questions"],
        "verification_answers": verification["verification_answers"],
        "trust_score": trust["trust_score"],
        "decision": decision,
        "diagnostics": trust["diagnostics"],
    }


def run() -> None:
    import uvicorn

    uvicorn.run("trust_estimator.webapp:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    run()
