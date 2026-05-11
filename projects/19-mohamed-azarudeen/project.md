---
slug: 19-mohamed-azarudeen
title: DataLens AI — Natural Language Data Visualization Agent
students:
  - "Mohamed Azarudeen"
tags:
  - data-visualization
  - local-llm
  - fastapi
  - react
  - e2b
  - sandboxed-execution
category: data-analysis
tagline: Ask your data anything in plain English — get instant, sandboxed visualizations powered by local LLMs.
featuredEligible: true
semester: "Spring 2026"
shortTitle: "DataLens AI"
studentId: "116514556"
videoUrl: "https://drive.google.com/file/d/1ZrVg6_y_JkN5OIs9vD4EWyW7ocJ8UCB3/view?usp=drive_link"
thumbnail: /thumbnails/19-mohamed-azarudeen.png
githubUrl: "https://github.com/AzaRKazar/llm-course-26-app-demo/tree/main/projects/19-mohamed-azarudeen/src"
---
## Problem

Data analysis is powerful but inaccessible. Business users and non-programmers sit on rich CSV datasets but cannot query them without SQL or Python knowledge. Existing tools either require cloud APIs (privacy concerns) or complex setup. Even simple questions like *"which city has the most customers?"* demand code.

## Solution

**DataLens AI** is a full-stack agentic application that bridges natural language and data insight. The user uploads any CSV file, asks a plain-English question, and receives an auto-generated, safely executed Python visualization — all running on a local LLM with no data ever sent to a third-party model.

Key design decisions:
- **FastAPI backend** with a clean layered architecture (routers → services → models), making each concern independently testable
- **Local Ollama LLM** (Llama, Mistral, DeepSeek, Qwen) keeps sensitive data on-premises
- **E2B sandboxed execution** — generated code never runs on the server; it executes in an isolated cloud micro-VM, preventing code injection or data leaks
- **React frontend** replaces Streamlit for a production-grade, component-driven UX with real-time feedback and query history

## User Flow

1. **Configure** — Enter E2B API key and select a local model from the sidebar
2. **Upload** — Drag-and-drop a CSV; the backend parses it, normalizes column names, and returns schema metadata instantly
3. **Query** — Type any natural language question (or pick a suggestion chip); press ⌘ Enter
4. **Analyze** — The backend:
   - Builds a schema-aware system prompt
   - Calls the local Ollama model to generate Python code
   - Uploads the CSV to an E2B sandbox and executes the code
   - Returns the rendered PNG chart (or text output) with execution time
5. **Explore** — Switch between Chart / Code / LLM Response tabs; revisit past queries from the history rail

## System Design

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                 │
│  ConfigPanel · UploadZone · QueryPanel          │
│  DatasetPreview · ResultPanel · HistoryBar      │
└───────────────────┬─────────────────────────────┘
                    │ REST (JSON)
┌───────────────────▼─────────────────────────────┐
│             FastAPI Backend                     │
│  POST /api/analysis/upload                      │
│  POST /api/analysis/run                         │
│  GET  /api/health                               │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Routers → Services → Pydantic Models    │    │
│  │                                         │    │
│  │  dataset_service  (parse, session store)│    │
│  │  llm_service      (Ollama, code extract)│    │
│  │  sandbox_service  (E2B execution)       │    │
│  └─────────────────────────────────────────┘    │
└───────┬──────────────────────┬──────────────────┘
        │                      │
┌───────▼──────┐   ┌───────────▼──────────────────┐
│  Ollama LLM  │   │     E2B Cloud Sandbox         │
│  (localhost) │   │  (isolated Python runtime)    │
└──────────────┘   └──────────────────────────────┘
```

## LLM Components

- **Schema-aware prompting** — The system prompt includes normalized column names, dtypes, and sample values so the model generates accurate column references without guessing
- **Code extraction** — Regex-based extractor pulls the first valid `python` fenced block from the LLM response, stripping any explanation text
- **Column normalization guard** — Both backend and sandbox inject a normalization step before model code runs, preventing column-name mismatches
- **Model choice** — Users pick from five local models (Llama 3.1/3.2, DeepSeek R1, Qwen 2.5, Mistral) to balance speed vs. reasoning depth

## Tools

- **Backend:** FastAPI, Uvicorn, Pydantic v2, Ollama Python SDK
- **LLM Runtime:** Ollama (local, on-premises)
- **Sandboxed Execution:** E2B Code Interpreter SDK
- **Data:** Pandas
- **Frontend:** React 18, Vite, CSS Modules, lucide-react, react-dropzone
- **Dev:** Docker Compose (optional), `.env` config
