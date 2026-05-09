# CodeStory

> AI-powered git archaeology — turn weeks of code archaeology into a 30-second story.

## Problem

- Developers spend ~⅓ of their time on code **maintenance**, not new features.
- `git blame` shows **who** and **when** — not **why**.
- Legacy code understanding relies on "tribal knowledge" buried in 100+ commits and closed issues.

## Solution

Give CodeStory a **git repo + file + function name** and it will:

1. **Blame** the function line-by-line (PyGit2).
2. **Trace** the full commit history touching that file.
3. **Fetch** linked GitHub issues / PRs via the REST API.
4. **Generate** a human-readable Markdown narrative using **Llama 3.2** (local Ollama or Groq cloud) covering: origin → refactors → bug fixes → current state.
5. **Display** an interactive commit timeline highlighting which commits touched your function.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    React Frontend                    │
│   InputForm → POST /analyze → Narrative + Timeline   │
└──────────────────────┬───────────────────────────────┘
                       │ JSON
┌──────────────────────▼───────────────────────────────┐
│                FastAPI  Backend                       │
│                                                      │
│  BlameAnalyzer ──► per-line blame (PyGit2)           │
│  HistoryTracer ──► commit walk + issue # extraction  │
│  ContextGatherer → GitHub REST API (issues / PRs)    │
│  StoryGenerator ─► Llama 3.2 (Ollama / Groq)        │
└──────────────────────────────────────────────────────┘
```

## Project Structure

```
CodeStory/
├── backend/
│   ├── main.py                     # FastAPI routes (POST /analyze, GET /health)
│   ├── requirements.txt
│   ├── .env.example
│   └── analyzers/
│       ├── __init__.py
│       ├── blame_analyzer.py       # PyGit2 blame + function line detection
│       ├── history_tracer.py       # Commit history walk + issue extraction
│       ├── context_gatherer.py     # GitHub REST API issue/PR lookup
│       └── story_generator.py      # LLM narrative generation
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── App.css
        └── components/
            ├── InputForm.jsx       # Form: repo path, file, function/lines
            ├── Narrative.jsx       # Renders Markdown narrative
            └── Timeline.jsx        # Commit timeline with blame highlights
```

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama** with `llama3.2` pulled (`ollama pull llama3.2`), _or_ a free [Groq API key](https://console.groq.com/)
- A local git repo to analyze

## Quick Start

### 1. Clone & install backend

```bash
cd CodeStory/backend
python -m venv ../.venv
source ../.venv/bin/activate   # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment (optional)

```bash
cp .env.example .env
# Edit .env:
#   GROQ_API_KEY=gsk_...       ← use Groq instead of local Ollama
#   GITHUB_TOKEN=ghp_...       ← raises GitHub API rate limit (60 → 5000/hr)
```

### 3. Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 4. Install & start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 5. Analyze a repo

Fill in the form:

| Field | Example |
|---|---|
| Repo path | `/tmp/requests` |
| File path | `src/requests/adapters.py` |
| Function name | `send` |
| GitHub URL | `https://github.com/psf/requests` |

Click **▶ Run CodeStory** and wait ~15–30 seconds for the narrative.

## API

### `POST /analyze`

**Request body:**

```json
{
  "repo_path": "/absolute/path/to/repo",
  "file_path": "src/utils.py",
  "function_name": "calculate_total",
  "github_repo_url": "https://github.com/owner/repo",
  "max_commits": 60
}
```

- Provide `function_name` **or** `start_line` + `end_line` (not both).
- `github_repo_url` is optional — used for issue/PR lookup.

**Response:**

```json
{
  "file_path": "src/utils.py",
  "line_range": [42, 98],
  "narrative_markdown": "## Overview\n...",
  "timeline": [{ "sha": "abc1234", "short_sha": "abc1234", "author": "...", ... }],
  "issues": [{ "number": 123, "title": "...", ... }],
  "blame_sample": [{ "line_number": 42, "content": "...", ... }]
}
```

### `GET /health`

Returns `{"status": "ok"}`.

## LLM Backends

| Priority | Backend | Config |
|---|---|---|
| 1 (if key set) | **Groq** `llama-3.3-70b-versatile` | `GROQ_API_KEY` env var |
| 2 (default) | **Ollama** `llama3.2` local | Ollama running on `localhost:11434` |

## Tech Stack

- **Backend:** Python, FastAPI, PyGit2, httpx, Pydantic
- **Frontend:** React 18, Vite, react-markdown
- **LLM:** Llama 3.2 via Ollama (local) or Groq (cloud)
- **APIs:** GitHub REST API v3

## License

MIT
