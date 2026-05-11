# Decoding SAS

> Your AI Research Assistant simplifying raw SAS output to clear, actionable insights.

Thumbnail Link: https://drive.google.com/file/d/1gdPYQtnrtYV9hOIMG9Q20Npz8GBgifVb/view?usp=drive_link

Video Link: https://drive.google.com/file/d/192tbcyevu4LdEVng_V4A-CWE5McyFzp_/view?usp=drive_link

---

## Problem

Researchers working with SAS statistical models often produce complex outputs — mixed models, regression results, covariance structures — that require deep statistical and domain knowledge to interpret. Research assistants and analysts are often technically proficient — capable of writing and executing SAS models — but lack the domain knowledge required to translate raw statistical output into meaningful, plain-English conclusions.

Existing public AI tools (ChatGPT, Gemini, Claude web) can interpret these outputs effectively, but **research data is sensitive and confidential**. Uploading statistical outputs or study data to public AI interfaces poses a serious privacy risk — data may be logged, stored, or used for model training.

There was no existing tool that combined AI-powered interpretation with a private, secure pipeline.

---

## Solution

**Decoding SAS** is a private, web-based AI application that allows researchers to:

- Upload SAS output files and receive plain-English summaries and interpretations
- Ask free-form follow-up questions with full conversation memory
- Upload a data dictionary or codebook so the AI understands study-specific variable names and terminology using **RAG (Retrieval-Augmented Generation)**
- Export the full session as a PDF report

All data is processed through the **OpenAI API**, which does not use API inputs for model training — keeping sensitive research data private and secure.

---

## User Flow

```
1. (Optional) Upload Data Dictionary / Codebook
        ↓
   File is chunked, embedded, and indexed into a FAISS vector store

2. Upload SAS Output
        ↓
   Supports PDF, image (multiple screenshots), Excel, DOCX

3. Click "Summarise"
        ↓
   Relevant variable definitions retrieved from FAISS (RAG)
   → GPT-4o generates a plain-English summary

   OR

   Click "Ask Question" → type any question
        ↓
   Relevant context retrieved from FAISS
   → GPT-4o answers using full conversation history

4. Ask follow-up questions
        ↓
   Conversation memory maintained — AI understands prior context

5. Export Session as PDF
        ↓
   Full Q&A session downloaded as a formatted report

6. Reset Session
        ↓
   All files, history, and indexed data cleared
```

---

## LLM Components

| Component | Description |
|---|---|
| **LLM** | GPT-4o via OpenAI API — used for summarisation, Q&A, and vision (image inputs) |
| **Embeddings** | `text-embedding-3-small` via OpenAI API — used to embed data dictionary chunks |
| **Vector Store** | FAISS (in-memory) — stores and retrieves embedded chunks from the data dictionary |
| **RAG Pipeline** | LangChain — handles text splitting, embedding, and similarity search |
| **System Prompt** | Custom prompt instructing the model to interpret SAS outputs, match variable names using partial/fuzzy logic, and explain results in plain English |
| **Conversation Memory** | Full message history passed to the API on each request — enables context-aware follow-up questions |

---

## Tools Used

### Backend
| Tool | Purpose |
|---|---|
| Python | Core backend language |
| FastAPI | REST API framework |
| uvicorn | ASGI server |
| OpenAI Python SDK | LLM and embeddings API calls |
| LangChain | RAG pipeline (text splitting, vector store) |
| FAISS | In-memory vector store for data dictionary |
| PyMuPDF (fitz) | PDF text extraction |
| pandas + openpyxl | Excel file parsing |
| python-docx | DOCX file parsing |
| python-dotenv | Environment variable management |
| uv | Python package and virtual environment manager |

### Frontend
| Tool | Purpose |
|---|---|
| React + TypeScript | UI framework |
| react-markdown | Render markdown in chat responses |
| jsPDF | Export session as PDF |
| CSS Variables | Light / dark mode theming |

---

## Project Structure

```
sas_p/
├── main.py                  # Entry point — FastAPI app, CORS, routers
├── .env                     # OPENAI_API_KEY
├── pyproject.toml
├── app/
│   ├── config.py            # OpenAI client and embeddings initialisation
│   ├── prompts.py           # System prompt
│   ├── extraction.py        # Text extraction (PDF, Excel, DOCX, image)
│   ├── rag.py               # FAISS vector store, retrieval, system prompt builder
│   └── routes/
│       ├── chat.py          # /chat endpoint
│       └── dictionary.py   # /upload-datadictionary, /reset-session endpoints
└── frontend/
    └── src/
        ├── App.tsx          # Main React component
        └── App.css          # Styles and theme variables
```

---

## Running Locally

**Backend**
```bash
source .venv/bin/activate
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm start
```

Open `http://localhost:3000` in your browser.

> Requires `OPENAI_API_KEY` set in `.env`
