# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- SOPs written in Markdown, live in `directives/`
- Define goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution

**Layer 3: Execution (Doing the work)**
- Deterministic Python scripts in `execution/`
- Environment variables, API tokens stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Commented well.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. Push complexity into deterministic code so you can focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/`. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it (unless it uses paid tokens — check w user first)
- Update the directive with what you learned

**3. Update directives as you learn**
Directives are living documents. Preserve and improve them; don't discard learnings.

## Self-annealing loop

1. Fix it
2. Update the tool
3. Test tool
4. Update directive
5. System is now stronger

## File Organization

- `.tmp/` — Intermediate files. Never commit, always regenerated.
- `execution/` — Python scripts (deterministic tools)
- `directives/` — SOPs in Markdown
- `.env` — Environment variables and API keys
- `backend/` — FastAPI app
- `frontend/` — React (Vite) app

---

## Project Context: Adaptive Socratic Tutor

An LLM-powered adaptive learning system that teaches through questions, never answers.

**Input sources:**
- Users log in via Google OAuth (Supabase Auth)
- Users can enter a **topic**, **paste a problem**, or **upload a PDF**
- PDF content is sent to Gemini as `source_text`; the filename is used as the display topic

**Question generation:**
- Generates Socratic-style questions (never directly gives answers)
- Each question includes: 3 progressive hints, a `concept_tag` (short 2–5 word label), and a `difficulty`
- `concept_tags[]` is a 2–4 item array of short topic labels — used for weak topic grouping
- `concept_tag` is stored in DB; `concept_tags[]` is returned in API only (not stored)

**Answer evaluation (LLM + deterministic):**
- Correctness + reasoning quality (scored 1–5)
- Open-ended: Gemini evaluates. MCQ: deterministic string match (zero token cost)

**Adaptive difficulty logic (between sessions, not within):**
- Score < 65% → easier distribution next session
- Score > 80% → harder distribution next session
- Otherwise → maintain current distribution
- All questions for a session are pre-generated in **one batch Gemini call** at session start
- NO per-question dynamic fetching during a quiz — that causes latency and was removed

**Tracking:**
- Concept-level mastery per user (client-side per session + DB cross-session)
- Weak/developing/strong topic classification from `concept_tags[]`
- Session-level performance

---

## Architectural Constraints

| Layer | Location | Role |
|-------|----------|------|
| Directive | `directives/` | LLM instructions (SOPs) |
| Execution | `execution/` | Deterministic Python scripts |
| Orchestration | You (the AI) | Decision-making and routing |

**Rules:**
- Do NOT embed business logic inside LLM prompts if it can be deterministic
- Always prefer `execution/` scripts for: data processing, DB operations, analytics
- Never call Supabase or Gemini directly from routes — route through execution scripts

**Tech stack:**
- **Frontend**: React (Vite) + vanilla CSS with CSS custom properties; Recharts for charts
- **Backend**: FastAPI (Python), running via `uvicorn` with the project `venv`
- **Database**: Supabase (PostgreSQL) — accessed via `supabase-py`
- **AI**: Google Gemini via `google-genai`; current model: `gemini-2.5-flash`
- **Auth**: Google OAuth → verified in backend → JWT session token

**Dev servers:**
- Backend: `source venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload` (run from project root)
- Frontend: `npm run dev` (run from `frontend/`)
- They share `.env` at project root; frontend uses `frontend/.env` for `VITE_*` vars

---

## Input Modes

1. **Topic Mode** → user enters a topic string → Gemini generates questions about it
2. **Problem Mode** → user pastes a problem → Gemini breaks it into 3–6 Socratic steps (no quiz)
3. **PDF Mode** → user uploads a PDF → backend extracts text → sent to Gemini as `source_text`; filename becomes the display topic

**PDF mode specifics:**
- Frontend sends: `topic = filename (cleaned)`, `source_text = full extracted text`
- Gemini uses `source_text` as reading material; `concept_tag` must still be a SHORT 2–5 word label
- The validator does NOT override Gemini's chosen concept_tag when `source_text` is provided (`enforce_concept_tag=False`)

---

## Authentication Handling

**Token lifecycle:**
- User logs in with Google OAuth → frontend sends Google ID token to `POST /auth/google`
- Backend verifies with Google, upserts user in Supabase, returns a signed JWT (24h expiry)
- JWT stored in `localStorage` under `socratic_user.session_token`

**Frontend rules:**
- ALL API calls must use `createApiClient(token, onUnauthorized)` from `src/lib/api.js`
- NEVER construct `Authorization` headers manually in components
- NEVER store tokens in component state

**Backend rules:**
- All protected routes use the `get_current_user` FastAPI dependency
- On error, return: `{"error": "token_expired" | "invalid_token" | "missing_token", "message": "..."}`
- Status 401 always

**Error handling:**
- Backend returns 401 → `createApiClient` calls `onUnauthorized()`
- `onUnauthorized` in `App.jsx` → `handleLogout()` + `window.location.replace('/')`

---

## Frontend Data Safety Rules

- NEVER assume API fields exist — always use optional chaining and fallbacks
- After every API call, normalize before setting state:
  ```js
  const normalized = data.questions.map(q => ({
    ...q,
    question_text: q.question_text || q.question || '',
    hint_1: q.hint_1 || '',
    concept_tags: (q.concept_tags?.length > 0) ? q.concept_tags : [q.concept_tag].filter(Boolean),
  }))
  ```

## Data Contract (Quiz Questions)

```json
{
  "id": "uuid",
  "question_text": "string",
  "concept_tag": "string (short 2-5 word label)",
  "difficulty": "easy | medium | hard",
  "hint_1": "string",
  "hint_2": "string",
  "hint_3": "string",
  "concept_tags": ["string", "string"]
}
```

- Questions are open-ended OR MCQ (controlled by `question_format` in `POST /quiz/start`)
- `concept_tag` is ALWAYS a short label — never raw PDF text or a sentence
- `concept_tags[]` is prompt-only (not stored in DB); used by frontend for weak topic grouping
- Hints are inline in `QuizStartResponse` — no separate hint fetch

---

## QuestionCard Interaction Model

**Phases:**
1. `answering` — user reads question, reveals progressive hints (1→2→3), types or selects answer
2. `evaluating` — spinner while Gemini or deterministic check runs
3. `feedback` — shows correct/incorrect + reasoning stars (open-ended) or option highlighting (MCQ) + Socratic follow-up hint when wrong

**What is NOT shown in feedback (removed):**
- Gemini feedback text
- Ideal answer
- Misconceptions

**Key rules:**
- `QuestionCard` manages phase state internally
- `QuizPage` only stores results (`onEvaluated`) and advances index (`onNext`)
- Progress bar fills based on `results.length` (not `currentIdx`)
- Final question: "See Results" instead of "Next Question" (`isLast` prop)

---

## Quiz Flow

```
POST /quiz/start
  → Gemini generates ALL questions in one batch call
  → session + questions stored in DB
  → frontend receives full question array

[User answers each question]
  → POST /quiz/answer (Gemini for open-ended; deterministic for MCQ)
  → result stored in DB

[All questions answered]
  → POST /quiz/complete (sets end_time → activates next-session adaptation)
  → frontend computes weak topics client-side from results[]
```

**Adaptive mode does NOT fetch questions one-by-one during a session.**
All questions are pre-generated at session start. Difficulty adapts for the NEXT session only.

---

## HCI Principles

- **Progressive disclosure** — hints reveal one at a time
- **Visibility of system status** — `GeneratingScreen` shown while Gemini works (cycling phase messages + progress bar)
- **Immediate feedback** — correct/incorrect shown inline
- **Error prevention** — Submit disabled when answer is empty
- **Minimal cognitive load** — one question at a time, clean layout, no emoji overload

---

## Scoring Rules (CRITICAL)

| Answer | reasoning_score |
|--------|----------------|
| correct == true | MUST be ≥ 4 |
| correct == false | MUST be ≤ 3 |

Enforced in Gemini prompt AND in `validate_evaluation()` as a deterministic safeguard.

---

## Quiz Modes

| Mode | Evaluation | Backend trigger |
|------|-----------|----------------|
| Open-ended | Gemini LLM evaluation | `correct_answer` is NULL in DB |
| MCQ | Deterministic string match | `correct_answer` is set in DB |

- `question_format` sent as `"open"` or `"mcq"` in `POST /quiz/start`
- MCQ: 4 options, one correct. Zero token cost.

---

## Adaptive Difficulty Distribution System

| Last session accuracy | Distribution |
|---|---|
| None (first quiz) | 40% easy / 40% medium / 20% hard |
| < 65% | 60% easy / 30% medium / 10% hard |
| 65%–80% | 40% easy / 40% medium / 20% hard |
| > 80% | 20% easy / 40% medium / 40% hard |

- List is shuffled so difficulty doesn't cluster
- Session `difficulty_level` in DB = the most common level in the distribution
- `/quiz/next` endpoint exists but is NOT used during a normal session (PDF/topic/adaptive all use batch)

---

## Concept Tagging

- `concept_tag` — SHORT label (2–5 words), stored in DB, shown in card header. Examples: `"Fault Tolerance"`, `"Two-Phase Commit"`
- `concept_tags[]` — array of 2–4 short labels returned only in API, used for weak topic grouping
- Prompts explicitly forbid long sentences or raw source text as tags
- Validator skips enforcement (`enforce_concept_tag=False`) when `source_text` is provided (PDF mode)
- Frontend normalizes: `concept_tags = q.concept_tags?.length > 0 ? q.concept_tags : [q.concept_tag]`

---

## Weak Topic Detection

- Computed client-side from `results[]` after quiz — no extra API call
- Uses `concept_tags[]` per result; falls back to `[concept_tag]`
- Thresholds:
  - `< 50%` → **weak**
  - `50–75%` → **developing**
  - `> 75%` → **strong**
- `execution/compute_concept_performance.py` implements the same logic for scripts/tests

---

## Reinforcement Mode

- Endpoint: `POST /quiz/reinforce` — input: `{ weak_topics[], question_format, previous_difficulty }`
- Generates one question per weak topic at `step_down_difficulty(previous_difficulty)`
- `step_down_difficulty`: easy → easy, medium → easy, hard → medium
- Returns `QuizStartResponse` — same shape as `/quiz/start`
- Session stored as `"Reinforcement: <tags>"` in DB
- Frontend shows CTA only when `weakTopics.length > 0`

---

## Session History

- `GET /sessions/recent` — last 5 sessions with accuracy
- `GET /sessions/{session_id}` — full replay: questions + answers + feedback + ideal_answer
- `DELETE /sessions/{session_id}` — cascades to questions/answers/analytics via FK
- Frontend optimistically removes row on delete success
- `SessionReviewPage.jsx` renders: correctness banner, student answer, ideal/correct answer, reasoning stars

---

## Concept Mastery Tracking

- **Session-level**: computed client-side after each quiz — instant
- **Cross-session**: `upsert_concept_mastery()` in `execution/store_results.py` → `concept_mastery` table
- Table: `user_id`, `concept_tag`, `attempts`, `correct_answers`, `mastery_score`

---

## Security (CRITICAL — Never Violate)

- `correct_answer` **must NEVER be sent to the frontend** in any API response
- Stored in `questions` DB table only, compared server-side in `POST /quiz/answer`
- `QuestionOut` Pydantic model has NO `correct_answer` field
- Applies to: `/quiz/start`, `/quiz/next`, `/quiz/reinforce`

---

## Adaptive System (CRITICAL)

- `_build_difficulty_list()` reads `end_time` to find the last *completed* session
- `end_time` is set by `POST /quiz/complete` — frontend MUST call this when the last question is answered
- Without this call, adaptive defaults to first-quiz distribution every session
- Frontend fires this in a `useEffect` when `quizComplete === true`

---

## Performance (CRITICAL — Strictly Enforced)

- **All quiz questions generated in a single Gemini call** — never loop N times
- `start_quiz()` uses `generate_questions_batch()` for adaptive mode
- `generate_questions()` used only for: forced-difficulty mode (one call, N identical difficulty), reinforcement mode
- Do NOT add per-question fetching inside `start_quiz()` — causes 20–50s latency
- Session created AFTER successful generation to prevent orphaned sessions on Gemini failure

---

## CORS / Error Handling

- Backend has a global `Exception` handler that injects CORS headers even on 500 crashes
- Without this, unhandled exceptions would cause opaque "Failed to fetch" CORS errors in the browser
- All `AnswerResponse` fields (`correct_answer`, `feedback`, `ideal_answer`, `socratic_hint`, etc.) are `Optional[str] = ""`
- This prevents Pydantic crashes when open-ended questions return `None` for MCQ-specific fields

---

## GeneratingScreen

- Shown whenever `quizLoading || problemLoading` is true in `QuizPage`
- Cycles through 6 phase messages with matching icons and estimated progress bar
- Props: `topic`, `mode`, `questionCount`, `difficulty`
- CSS lives in `index.css` under `/* Generating Screen */` section
- Follows HCI: visibility of system status, informative micro-copy, accessible (`role="status"`, `aria-live="polite"`)
