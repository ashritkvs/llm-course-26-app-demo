# ◈ DataLens AI — v2.0

> Natural language → instant data visualization, powered by local LLMs and sandboxed execution.

## Architecture

```
ai-data-viz-agent/
├── backend/                  FastAPI backend
│   ├── main.py               App entry point + CORS
│   ├── core/
│   │   └── config.py         Pydantic settings (.env)
│   ├── routers/
│   │   ├── health.py         GET /api/health
│   │   └── analysis.py       POST /api/analysis/upload|run
│   ├── services/
│   │   ├── dataset_service.py  CSV parsing, session store, schema
│   │   ├── llm_service.py      Ollama prompt + code extraction
│   │   └── sandbox_service.py  E2B isolated execution
│   ├── models/
│   │   └── schemas.py        Pydantic request/response models
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                 React + Vite frontend
│   ├── src/
│   │   ├── components/       Header, ConfigPanel, UploadZone,
│   │   │                     DatasetPreview, QueryPanel, ResultPanel
│   │   ├── lib/api.js        Axios API client
│   │   ├── App.jsx           Top-level state + layout
│   │   └── index.css         CSS design system variables
│   ├── vite.config.js        Dev proxy → backend :8000
│   ├── package.json
│   └── Dockerfile
│
├── project.md                Showcase submission
├── docker-compose.yml        One-command local dev
└── README.md
```

## Quick Start

### Prerequisites

| Tool | Purpose |
|------|---------|
| Python 3.11+ | Backend runtime |
| Node.js 20+ | Frontend build |
| [Ollama](https://ollama.com/download) | Local LLM runtime |
| E2B API key | Sandboxed code execution |

### 1. Clone

```bash
git clone https://github.com/<your-username>/ai-data-viz-agent.git
cd ai-data-viz-agent
```

### 2. Pull a local model

```bash
ollama pull llama3.1:8b        # or any supported model
```

### 3. Backend

```bash
cd backend
cp .env.example .env           # add your E2B_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 5. (Optional) Docker Compose

```bash
E2B_API_KEY=your_key docker compose up
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/analysis/upload` | Upload CSV → `DatasetMeta` + `session_id` |
| POST | `/api/analysis/run` | Run NL query → chart PNG + code + timing |

Full interactive docs at `http://localhost:8000/docs`.

## How It Works

1. **Upload** — CSV parsed by Pandas, columns normalized, stored in session memory with a UUID
2. **Prompt** — Backend builds a schema-aware system prompt including column names, dtypes, sample values
3. **Generate** — Local Ollama model returns Python code inside a fenced block
4. **Execute** — Code + CSV uploaded to an E2B micro-VM sandbox; result PNG streamed back
5. **Display** — React frontend renders chart, code, and LLM explanation in tabbed view

## Supported Models

| Model | Size | Best for |
|-------|------|----------|
| Llama 3.1 8B | 8B | Fast general analysis |
| Llama 3.2 | 3B | Lightweight / quick |
| DeepSeek R1 7B | 7B | Step-by-step reasoning |
| Qwen 2.5 7B | 7B | Balanced |
| Mistral | 7B | Flexible |

## Security

- **No model API calls** — all LLM inference stays on your machine via Ollama
- **Sandboxed execution** — generated code runs in E2B's isolated VM, not on your server
- **No data persistence** — sessions are in-memory; CSV bytes are never written to disk on the backend
