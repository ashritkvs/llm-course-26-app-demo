---
slug: 34-venkata-sai-ashrit-kommireddy
title: Modelscope-lite 
students:
  - Venkata Sai Ashrit Kommireddy
tags: 
  - developer-tools
  - visualizer
  - dataset
category: developer tool
tagline: "AI Powered Dataset Health checker to identify inconsistencies or anomalies."
featuredEligible: true

semester: "Spring 2026"

shortTitle: "ModelScope-Lite"
studentId: "116496667"
videoUrl: "https://drive.google.com/file/d/1ad5Qmceyz_JEycp2rFVtExe7z9HbIjce/view?usp=drive_link"
thumbnail: "https://drive.google.com/file/d/1z8GjMl7qcUT97MMfedU2MdMzT8pEBMzP/view?usp=drive_link"
githubUrl: "https://github.com/solhapark"
---



## Problem

Tabular datasets used for modeling are often messy before training: missing values, duplicate rows, redundant numeric features (high pairwise correlation), and skewed label distributions. Practitioners need a lightweight way to **inspect**, **quantify quality**, and optionally **clean** data without opening a notebook for every file.

## Solution

**ModelScope Lite** is a small full-stack app: a **FastAPI** backend performs pandas-based loading, profiling, a composite **dataset health score** (0–100), optional **LLM-generated narrative** from structured analysis, and **cleaning** endpoints (deduplication, numeric imputation, bundled CSV download). A **React + Vite** SPA uploads files, shows a five-row preview, surfaces issues and health score, displays the AI report, and triggers cleaning actions via **axios** against a deployed API.

## User Flow

1. Choose a dataset (`.csv`, `.xlsx`, `.xls`, or `.json`).
2. **Upload and Preview** — first five rows, column names, row/column counts.
3. **Analyze Dataset** — missing % per column, duplicate count, dtypes, mean/std for numeric columns, correlation matrix, pairs with `|r| > 0.8`, health score with penalty breakdown, and an **AI-generated report** (Summary / Risks / Fixes) when `OPENAI_API_KEY` is set.
4. Optionally **Remove Duplicates** or **Fill Missing** on numeric columns using **mean** or **median** (preview updates with a short summary).
5. Toggle **Remove duplicates** / **Fill missing** and **Download Cleaned Dataset** as CSV (`{original_basename}_cleaned.csv`).

## LLM Components

- **Model:** OpenAI **gpt-4o-mini** via the **Responses API** (`client.responses.create`).
- **Role:** Data-quality assistant that reads a JSON serialization of the analysis payload (numeric profile and health metadata only at call time) and returns a fixed outline: **Summary**, **Risks**, **Fixes**, under ~180 words.
- **Resilience:** If the key is missing or the provider errors, `/analyze` still returns full numeric analysis; `ai_report` is `null` and `ai_report_error` carries the message so the UI can show the error without failing the request.

## Tools

| Layer | Stack |
|--------|--------|
| **Backend** | Python 3, **FastAPI**, **uvicorn**, **pandas**, **python-multipart**, **openpyxl** (Excel), **python-dotenv**, **openai** |
| **Frontend** | **React 18**, **Vite 5**, **@vitejs/plugin-react**, **axios** |
| **API docs** | FastAPI auto **OpenAPI** at `/docs` when running locally |
| **Hosting (as wired in code)** | Backend referenced at `https://modelscope-lite.onrender.com`; CORS allows **localhost:5173**, **modelscope-lite.vercel.app**, and regex `https://.*\.vercel\.app` for previews |

### Repository layout (under `src/`)

```text
src/
├── app/
│   ├── main.py              # Routes: /, /upload, /analyze, /clean/*
│   ├── config.py            # OPENAI_API_KEY via dotenv
│   └── services/
│       ├── file_loader.py   # Extension checks; CSV / Excel / JSON → DataFrame
│       ├── data_analyzer.py # Profiling, correlations, health score
│       ├── data_cleaner.py  # drop_duplicates, numeric fillna, CSV bytes
│       └── ai_analyzer.py   # OpenAI report generation
├── frontend/                # Vite React app (npm in this folder)
└── README.md
```

### API summary

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health JSON |
| `POST` | `/upload` | Form `file` → preview + columns + shape |
| `POST` | `/analyze` | Form `file` → full analysis + optional `ai_report` |
| `POST` | `/clean/remove-duplicates` | Form `file` → removed count + new preview summary |
| `POST` | `/clean/fill-missing` (query `strategy`: `mean` / `median`) | Form `file` → filled cell count + summary |
| `POST` | `/clean/download?remove_duplicates&fill_missing&strategy` | Form `file` → streaming CSV attachment |

### Health score logic (high level)

Penalties cap toward 100: **missing** (severe if column >20% missing, moderate >5%), **duplicates** (ratio-based), **high correlation** (count of pairs above threshold, default 0.8), **class imbalance** when a label column is inferred (`label`, `target`, `class`, `y`, case-insensitive) and majority class share > 80%. Final score: `max(0, 100 - total_penalty)`.

### Local development

- Backend: from `src`, `pip install -r frontend/requirements.txt` (project requirements live beside frontend in this tree), then `uvicorn app.main:app --reload` (default `http://127.0.0.1:8000`).
- Frontend: `cd src/frontend`, `npm install`, `npm run dev` → `http://127.0.0.1:5173`. Point `api.js` `baseURL` at local `http://127.0.0.1:8000` when testing against a local server instead of Render.
