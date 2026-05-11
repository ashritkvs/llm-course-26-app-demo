# Project Overview: LLM Trust Estimation via Claim-Level Verification

## 1. Project Summary

This project is a lightweight LLM answer trust estimation system for natural science question answering. Instead of trusting a model's first response directly, the system generates a draft answer, extracts the key claims inside it, verifies those claims with follow-up questions, and then computes a rule-based trust score.

The main goal is not just to produce an answer, but to estimate whether that answer should be accepted, flagged as low confidence, or withheld.

## 2. Problem

Large language models can produce fluent and plausible answers even when parts of the reasoning are wrong, incomplete, or fabricated. In scientific Q&A, this is especially risky because users may trust a confident explanation that contains incorrect mechanisms, calculations, or factual statements.

The core problem this project addresses is:

- How can we evaluate the trustworthiness of an LLM-generated answer at inference time?
- How can we do this without exposing or depending on full hidden chain-of-thought?
- How can we make the final confidence judgment interpretable rather than purely intuitive?

## 3. Solution

The project implements a claim-level verification pipeline inspired by CoVe-style verification:

1. Generate a draft answer with a concise reasoning summary.
2. Extract atomic claims from that answer.
3. For each claim, generate several verification questions.
4. Answer those verification questions independently.
5. Map each verification answer to `SUPPORTS`, `REFUTES`, or `UNCERTAIN`.
6. Aggregate the evidence with explicit scoring rules.
7. Return a final `trust_score` and decision:
   `ACCEPT`, `LOW_CONFIDENCE`, or `ABSTAIN`.

This makes the system more transparent than a single-pass LLM answer, because the confidence judgment is grounded in claim-level evidence.

## 4. User Flow

### CLI flow

1. User asks a question in Chinese or English.
2. `main.py` detects or normalizes the language.
3. The LLM produces a draft answer.
4. The system extracts structured claims.
5. The verifier generates and answers claim-specific questions.
6. The checker computes the trust score.
7. The decision module returns the final trust label.
8. The program prints a JSON result.



### Web flow

1. User opens the FastAPI web demo.
2. User enters a question and optional settings.
3. Frontend sends the request to `/api/estimate`.
4. Backend runs the same trust-estimation pipeline.
5. The interface shows the trust score, decision, and diagnostics.

The project also provides an embeddable widget through `web/widget.js`.

## 5. System Architecture

### Entry points

- `main.py`: command-line interface for running the full pipeline.
- `trust_estimator/webapp.py`: FastAPI server with `/api/estimate`, `/`, and `/widget.js`.

### Core modules

- `trust_estimator/generator.py`
  Generates a draft answer with a concise reasoning summary and final answer.

- `trust_estimator/claim_extractor.py`
  Extracts atomic, structured claims from the draft answer and marks whether each claim is critical or supports the final conclusion.

- `trust_estimator/verifier.py`
  Generates per-claim verification questions and obtains independent verification answers. It also includes non-LLM relevance and answer-shape checks to catch low-quality verification outputs.

- `trust_estimator/checker.py`
  Aggregates verification evidence into per-claim status and overall trust score using explicit numerical rules.

- `trust_estimator/decision.py`
  Converts the trust score and diagnostics into the final decision: `ACCEPT`, `LOW_CONFIDENCE`, or `ABSTAIN`.

- `trust_estimator/llm.py`
  Wraps OpenAI calls, supports structured JSON outputs, handles API fallback behavior, and provides a deterministic mock backend.

- `trust_estimator/schemas.py`
  Defines JSON schemas for draft answers, extracted claims, verification questions, and verification answers.

- `trust_estimator/lang.py`
  Handles language normalization and bilingual behavior.

## 6. LLM Components

This project uses LLMs in a structured, modular way instead of one single free-form generation step.

### Component 1: Draft answer generation

Purpose:
- Produce an initial scientific answer.
- Return a concise reasoning summary rather than hidden chain-of-thought.

Output fields include:
- `reasoning_summary`
- `final_answer`
- `draft_answer`

### Component 2: Claim extraction

Purpose:
- Break the draft answer into verifiable atomic claims.
- Label which claims are core to the final conclusion.

Each claim includes:
- `claim_id`
- `text`
- `category`
- `supports_final`
- `critical`

### Component 3: Verification question generation

Purpose:
- Create targeted questions that test whether each claim is actually justified.

Expected answer types include:
- `short_fact`
- `definition`
- `explanation`
- `calculation`
- `yes_no`

### Component 4: Verification answering

Purpose:
- Answer verification questions independently from the original draft answer.
- Judge whether the evidence supports or refutes the claim.

Each verification answer includes:
- `answer`
- `stance_wrt_claim`
- `confidence`
- `rationale_brief`

### Component 5: Rule-based trust decision

Purpose:
- Avoid using another unconstrained LLM step to decide trust.
- Keep the final decision interpretable and reproducible.

## 7. Non-LLM Logic

An important design choice is that the final trust judgment is not delegated to the LLM.

Non-LLM logic includes:

- JSON schema enforcement for structured outputs.
- Relevance checking between verification questions and answers.
- Simple keyword and variable coverage checks.
- Lightweight format checks for calculations, binary answers, and directional answers.
- Weighted aggregation of support, refute, and uncertainty mass.
- Explicit threshold-based decision rules.

This hybrid design improves interpretability and reduces the chance that a second LLM pass simply repeats the first answer's bias.

## 8. Scoring and Decision Policy

The system computes a `trust_score` in the range `[0, 1]`, with emphasis on core claims:

- Core claims are claims marked `critical` or `supports_final`.
- Refuting a core claim is heavily penalized.
- High uncertainty on core claims can also force abstention.
- Auxiliary claims only make small adjustments to the final score.

Decision policy:

- `trust_score >= 0.80` -> `ACCEPT`
- `0.55 <= trust_score < 0.80` -> `LOW_CONFIDENCE`
- `trust_score < 0.55` -> `ABSTAIN`

There are also hard rules:

- If a critical or final-supporting claim is refuted, the system may directly abstain.
- If multiple core claims remain uncertain, the system may abstain even when the average score is moderate.

## 9. Inputs and Outputs

### Input

The main input is a natural science question, for example in physics, chemistry, or biology.

Optional controls include:

- model name
- language
- temperature
- max output tokens
- reasoning effort
- max number of claims
- number of verification questions per claim
- mock mode

### Output

The pipeline returns structured JSON with fields such as:

- `question`
- `draft_answer`
- `extracted_claims`
- `verification_questions`
- `verification_answers`
- `trust_score`
- `decision`
- `diagnostics`

This output is useful both for interactive use and for debugging or analysis.

## 10. Tools and Technologies Used

### Models and APIs

- OpenAI API
- Default model: `gpt-4o`

### Project Assets

- Google Drive folder: `https://drive.google.com/drive/u/0/folders/11HzlNeJcJnBL_58mfMauIcPs6VN4PlMs`
- Included assets: demo video and thumbnail image

### Backend

- Python 3.9
- FastAPI
- Uvicorn

### Frontend

- Static HTML
- Vanilla JavaScript widget

### Environment and packaging

- `requirements.txt`
- `environment.yml`
- Conda or `venv`

## 11. Repository Structure

```text
llm_detector/
├── main.py
├── README.md
├── requirements.txt
├── environment.yml
├── project.md
├── trust_estimator/
│   ├── llm.py
│   ├── generator.py
│   ├── claim_extractor.py
│   ├── verifier.py
│   ├── checker.py
│   ├── decision.py
│   ├── schemas.py
│   ├── lang.py
│   └── webapp.py
├── web/
│   ├── index.html
│   └── widget.js
└── examples/
    ├── mock_output.json
    ├── mock_output_en.json
    ├── mock_output_free_fall.json
    └── mock_output_reaction_rate.json
```

## 12. Why This Project Is Interesting

This project is interesting because it treats answer reliability as a first-class problem rather than an afterthought. Instead of asking "What answer did the model generate?", it asks "Which parts of the answer are carrying the conclusion, and do those parts survive independent checking?"

That makes the system useful for:

- safer scientific Q&A
- interpretable LLM evaluation
- demonstrations of inference-time self-verification
- research prototypes for selective answering and abstention

## 13. Current Limitations

- The project is currently focused on natural science questions rather than general-domain QA.
- Verification still depends on the same underlying model family unless the backend is extended.
- Rule thresholds are hand-designed and may need calibration on a benchmark dataset.
- Keyword-based relevance checks are intentionally simple and may miss some semantic matches.
- Mock mode only supports a limited set of predefined topics.

## 14. Possible Future Improvements

- Use separate models for answer generation and verification.
- Add retrieval or tool use for external evidence grounding.
- Calibrate trust thresholds using evaluation data.
- Expand domain coverage beyond science education questions.
- Store traces for experiment analysis and error studies.
- Add benchmark scripts and quantitative evaluation metrics.

## 15. One-Sentence Pitch

This project builds a claim-by-claim trust checker for LLM scientific answers, combining structured OpenAI generation with independent verification and rule-based confidence decisions.
