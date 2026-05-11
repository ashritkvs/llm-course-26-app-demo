# Adaptive Socratic Tutor

An AI-powered learning system that teaches through questions — never by giving away answers. Built with Google Gemini, FastAPI, React, and Supabase.

---

## What it does

The Socratic Tutor generates intelligent quiz questions on any topic, evaluates your reasoning, adapts difficulty based on your performance, and helps you discover where your understanding is weak — all without ever just telling you the answer.

**Three input modes:**
- **Topic** — type any subject (e.g. "Distributed Systems", "Calculus", "Thermodynamics")
- **Problem** — paste a specific problem and get step-by-step Socratic guidance
- **PDF** — upload a document and get a quiz generated from its contents

**Two question formats:**
- **Open-ended** — type a free-text answer; Gemini evaluates reasoning quality (scored 1–5)
- **MCQ** — 4-option multiple choice; evaluated deterministically (zero token cost)

---

## Key features

| Feature | Detail |
|---|---|
| Socratic questions | Never reveals the answer directly; 3 progressive hints per question |
| Adaptive difficulty | Adjusts at the start of each session based on last session accuracy |
| Batch generation | All questions generated in **one Gemini call** — no per-question latency |
| PDF support | Full text sent to Gemini as context; filename used as the display topic |
| Concept tagging | Short 2-5 word labels per question (e.g. "Fault Tolerance") |
| Weak topic detection | Client-side mastery grouping from multi-tag responses |
| Reinforcement mode | Auto-generates a focused quiz on your weakest concepts |
| Session review | Full replay of any past session with your answers and reasoning |
| MCQ security | `correct_answer` is never sent to the frontend — compared server-side only |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + vanilla CSS + Recharts |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini (`gemini-2.5-flash`) |
| Auth | Google OAuth → backend-issued JWT |

---

## Project structure

```
Socratic-Tutor/
├── backend/
│   ├── main.py           # All FastAPI routes
│   ├── models.py         # Pydantic request/response models
│   ├── quiz_engine.py    # Adaptive difficulty engine (start_quiz)
│   ├── auth.py           # JWT verification
│   └── requirements.txt
│
├── execution/            # Deterministic Python scripts (3-layer arch)
│   ├── generate_questions.py     # Gemini prompt builders + validators
│   ├── evaluate_answer.py        # Answer evaluation (open-ended + MCQ)
│   ├── store_results.py          # Supabase write operations
│   ├── adaptive_difficulty.py    # Per-attempt difficulty logic (unused in quiz flow)
│   ├── compute_analytics.py      # Session analytics computation
│   ├── compute_concept_performance.py  # Weak/strong topic classification
│   ├── process_pdf.py            # PDF text extraction pipeline
│   ├── extract_pdf_text.py       # Raw PDF → text
│   ├── solve_problem.py          # Problem mode Socratic steps
│   ├── expand_topic.py           # Topic expansion for concept generation
│   ├── generate_analytics.py     # Analytics generation scripts
│   └── supabase_client.py        # Shared Supabase client
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── QuizPage.jsx          # Main quiz + setup flow
│       │   ├── DashboardPage.jsx     # Analytics dashboard
│       │   ├── SessionReviewPage.jsx # Past session replay
│       │   └── LoginPage.jsx
│       ├── components/
│       │   ├── QuestionCard.jsx      # Answering → evaluating → feedback
│       │   ├── GeneratingScreen.jsx  # Loading state while Gemini works
│       │   ├── AnalyticsChart.jsx    # Recharts performance visualisations
│       │   ├── ProblemSolver.jsx     # Problem mode UI
│       │   ├── HintReveal.jsx        # Progressive hint component
│       │   └── quiz-setup/           # Config panel, mode toggle, PDF uploader…
│       ├── lib/
│       │   └── api.js                # createApiClient (auth + error handling)
│       └── index.css                 # Global design system (dark theme)
│
├── directives/           # SOPs for each system capability (Markdown)
│   ├── question_generation.md
│   ├── answer_evaluation.md
│   ├── pdf_processing.md
│   ├── analytics_generation.md
│   └── topic_expansion.md
│
├── .env                  # API keys and secrets (never commit)
├── AGENTS.md             # AI agent instructions (mirrored to CLAUDE.md / GEMINI.md)
└── migration_add_mcq_columns.sql   # DB schema migration
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Google Cloud project with OAuth credentials
- A [Google AI Studio](https://aistudio.google.com) API key

### 1. Clone and configure environment

```bash
git clone <repo-url>
cd Socratic-Tutor
cp .env.example .env   # fill in values below
```

**`.env` keys required:**

```env
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-anon-or-service-key

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# Google OAuth (for backend token verification)
GOOGLE_CLIENT_ID=your-google-client-id

# JWT signing
JWT_SECRET=a-long-random-secret-string
```

**`frontend/.env` keys required:**

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### 2. Run the database migration

Open your Supabase project → SQL Editor → paste and run `migration_add_mcq_columns.sql`.

This adds the `options`, `correct_answer`, `feedback`, `ideal_answer`, `reasoning_score`, `misconceptions`, `hints_used`, `response_time`, `accuracy`, `avg_reasoning_score`, `hint_usage_rate`, `weak_topics`, and `strong_topics` columns required by the application.

### 3. Start the backend

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## API reference

### Auth

| Method | Route | Description |
|---|---|---|
| POST | `/auth/google` | Exchange Google ID token for our JWT |

### Quiz

| Method | Route | Description |
|---|---|---|
| POST | `/quiz/start` | Generate all questions for a session |
| POST | `/quiz/answer` | Submit an answer for evaluation |
| POST | `/quiz/complete` | Mark session complete (activates next-session adaptation) |
| POST | `/quiz/next` | Generate one question dynamically (reinforcement use) |
| POST | `/quiz/reinforce` | Start a reinforcement quiz on weak topics |

### Sessions

| Method | Route | Description |
|---|---|---|
| GET | `/sessions/recent` | Last 5 sessions with accuracy |
| GET | `/sessions/{id}` | Full session replay |
| DELETE | `/sessions/{id}` | Delete session (cascades) |

### Upload

| Method | Route | Description |
|---|---|---|
| POST | `/upload/pdf` | Extract text from a PDF file |

---

## How adaptive difficulty works

The system adapts difficulty **between sessions**, not within one:

1. User completes quiz → `POST /quiz/complete` records `end_time`
2. Next time they start a quiz in adaptive mode, `_get_last_accuracy()` reads the last completed session
3. A difficulty distribution is chosen based on accuracy:

| Last session score | Easy | Medium | Hard |
|---|---|---|---|
| First quiz (no history) | 40% | 40% | 20% |
| < 65% | 60% | 30% | 10% |
| 65%–80% | 40% | 40% | 20% |
| > 80% | 20% | 40% | 40% |

4. All N questions are generated in **one Gemini call** with their assigned difficulties, then pre-loaded into the UI.

---

## How PDF mode works

1. User uploads a PDF → `POST /upload/pdf` extracts text
2. Frontend sets `topic = filename` (cleaned), `source_text = full PDF text`
3. `/quiz/start` receives both fields; `source_text` is passed through `start_quiz()` → `generate_questions()`
4. Gemini receives the source text as a reading block and generates questions from its actual content
5. `concept_tag` on each question is a short label (e.g. "Fault Tolerance") — never raw PDF text
6. Weak/strong topics are computed from these short labels, not from the document text

---

## Concept tagging and weak topics

Every question has:
- `concept_tag` — a short 2–5 word label (stored in DB, shown in card)
- `concept_tags[]` — 2–4 short labels (returned in API, not stored)

After the quiz, weak topics are computed client-side:

```
< 50% correct on a concept → weak
50–75% → developing
> 75% → strong
```

Clicking "Practice Weak Topics" calls `POST /quiz/reinforce` which generates one question per weak concept at a stepped-down difficulty.

---

## Architecture: 3 layers

This project follows a strict 3-layer architecture to keep LLM calls isolated from business logic:

```
Directive (directives/*.md)
    ↓ read by
Orchestration (you / backend routes)
    ↓ calls
Execution (execution/*.py)
    ↓ calls
Supabase / Gemini API
```

**Why:** deterministic code in `execution/` is testable and reliable. LLM calls are isolated to specific scripts. Routes only coordinate — they don't contain business logic.

---

## Design system

- Dark theme (`#0a0e1a` background)
- Accent: indigo/violet (`#6366f1` → `#8b5cf6`)
- Glassmorphism cards with `backdrop-filter: blur`
- Inter typeface (Google Fonts)
- All tokens in CSS custom properties (`index.css`)
- Animations: `fadeInUp`, `fadeIn`, `pulse`, `orbFloat`, `shimmer`

---

## Known constraints (MVP)

- Session history limited to last 5 displayed (older sessions still accessible via UUID)
- Analytics dashboard is basic — no concept graphs or reinforcement learning
- No multi-user collaboration or class-level analytics
