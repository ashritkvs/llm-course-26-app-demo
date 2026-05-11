# TA Reply Copilot

A browser extension and lightweight backend for course-assistant that helps TAs draft policy-correct replies with citations. The system is retrieval-grounded, citation-first, and conservative - it will abstain when evidence is insufficient.

Video link: https://drive.google.com/file/d/1HqHF4LYP73jIJx-HUlOEXy7Hlc-jPYEX/view?usp=drive_link

Thumbnail link: https://drive.google.com/file/d/1LpNd6XFMEM9C2ePSOgrO3J_2TFwvLqr0/view?usp=drive_link

## Architecture

```
ta-reply-copilot/
├── backend/                 # Python FastAPI service
│   ├── app/
│   │   ├── api/            # REST API endpoints
│   │   ├── core/           # Config & LLM abstraction
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   │   ├── document_parser.py
│   │   │   ├── conflict_detector.py
│   │   │   ├── retriever.py
│   │   │   ├── indexer.py
│   │   │   └── qa_engine.py
│   │   └── storage/        # SQLite database
│   ├── tests/              # Unit tests
│   │   ├── test_document_parser.py
│   │   ├── test_retriever.py
│   │   ├── test_functional.py
│   │   └── test_reliability.py
│   └── main.py            # Entry point
├── extension/              # Chrome extension (React)
│   ├── src/
│   │   ├── pages/         # Popup, SidePanel, Options
│   │   ├── utils/         # API client
│   │   └── components/   # Reusable components
│   └── manifest.json
├── sample_data/           # Demo documents
└── README.md
```

## System Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Student/TA    │────▶│  Chrome          │────▶│  FastAPI        │
│   User          │     │  Extension       │     │  Backend        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                            │
                         ┌──────────────────────────────────┘
                         ▼
                  ┌────────────────┐     ┌──────────────────┐
                  │  Document     │     │  FAISS Vector    │
                  │  Parser       │────▶│  Index           │
                  │  (PyMuPDF)   │     │  + BM25         │
                  └────────────────┘     └──────────────────┘
                                                 │
                    ┌─────────────────────────────┴───────────────┐
                    ▼                                                   ▼
             ┌────────────────┐                              ┌────────────────┐
             │  Retrieval    │                              │  LLM          │
             │  + Filtering  │─────────────────────────────▶│  (Optional)    │
             └────────────────┘                              └────────────────┘
                    │
      ┌─────────────┴─────────────┐
      ▼                             ▼
┌──────────────────┐      ┌──────────────────┐
│  Visibility     │      │  Conflict        │
│  Filtering      │      │  Detection       │
└──────────────────┘      └──────────────────┘
```

## Features

### Student Mode
- Ask questions about course materials
- Get answers with citations from uploaded documents
- See evidence status (Verified/Partially Supported/Insufficient Evidence/Conflict Detected)
- System abstains when evidence is insufficient

### TA Mode
- Paste student email/question
- Generate draft reply with evidence
- See missing information and clarifying questions
- Copy draft for manual review (no auto-send)
- Conservative guardrails - doesn't auto-approve exceptions

### Admin Mode
- Upload course documents (PDF, HTML, TXT)
- View indexed sources and chunk counts
- Rebuild search index

## Reliability Mechanisms

### Evidence Status
| Status | Description |
|--------|-------------|
| **Verified** | High relevance, multiple supporting sources |
| **Partially Supported** | Medium relevance, some support |
| **Insufficient Evidence** | Low relevance or no results |
| **Conflict Detected** | Conflicting policies found |

### Conflict Detection
- Structured field extraction for key policy slots (deadline, late_penalty, collaboration)
- Hierarchical precedence:
  1. More specific scope wins (assignment_specific > general)
  2. Higher source type priority (assignment > announcement > syllabus)
  3. Later effective_date wins

### Visibility Filtering
- `student` mode: Only retrieves visibility="student" content
- `ta` mode: Retrieves all content (student + ta + instructor)

### TA Draft Guardrails
- Never approve exceptions without explicit policy support
- Use non-committal language ("According to the policy..." not "You may...")
- Always include review notice
- Recommend instructor confirmation for ambiguous cases

## Prerequisites

- Python 3.9+
- Node.js 18+
- Chrome/Chromium browser

## Setup

### 1. Backend Setup

```bash
cd ta-reply-copilot/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env`:

```env
# LLM Configuration (optional - works without for retrieval-only mode)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo
LLM_PROVIDER=openai  # or "retrieval_only"

# Storage
FAISS_INDEX_PATH=./data/index
DOCUMENT_STORE_PATH=./data/documents
DATABASE_URL=sqlite:///./data/metadata.db

# Server
HOST=0.0.0.0
PORT=8000
```

### 3. Start Backend

```bash
python main.py
# OR
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 4. Extension Setup

```bash
cd ta-reply-copilot/extension

# Install dependencies
npm install

# Build
npm run build
```

### 5. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

## Usage

### Quick Start (Demo Mode)

The system works without an OpenAI API key in retrieval-only mode:

1. Start the backend
2. Load the extension
3. Open the side panel (click extension icon)
4. Go to "Sources" tab
5. Upload sample documents from `sample_data/`
6. Try asking questions in "Ask" tab

### Using with LLM

To enable AI-powered answer generation:

1. Get an OpenAI API key
2. Set `OPENAI_API_KEY` in `.env`
3. Set `LLM_PROVIDER=openai`
4. Restart backend

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/ask` | POST | Student Q&A |
| `/api/v1/draft_reply` | POST | TA draft generation |
| `/api/v1/ingest` | POST | Upload document |
| `/api/v1/sources` | GET | List indexed sources |
| `/api/v1/rebuild-index` | POST | Rebuild search index |

## API Schema

### POST /ask Request
```json
{
  "question": "When is Project 2 due?",
  "mode": "student",
  "top_k": 5
}
```

### POST /ask Response
```json
{
  "answer": "Project 2 is due October 20, 2024...",
  "confidence": "high",
  "evidence_status": "verified",
  "citations": [
    {
      "source_id": "abc123",
      "source_name": "Syllabus",
      "source_type": "syllabus",
      "page_number": 1,
      "snippet": "..."
    }
  ],
  "conflicts": [],
  "unsupported": false,
  "clarification_needed": false,
  "clarification_question": null
}
```

### POST /draft_reply Request
```json
{
  "student_email_text": "Can I have an extension?",
  "mode": "ta",
  "top_k": 5
}
```

### POST /draft_reply Response
```json
{
  "suggested_reply": "Dear Student,\n\nBased on the course policy...",
  "confidence": "high",
  "evidence_status": "verified",
  "citations": [...],
  "conflicts": [],
  "missing_info": [],
  "clarification_questions": [],
  "policy_warning": false,
  "requires_ta_review": true
}
```

## Sample Data

The `sample_data/` folder contains demo documents:

- `syllabus.txt` - Course syllabus with policies
- `announcement_late_policy.txt` - Late policy announcement
- `project2_rubric.txt` - Project 2 requirements
- `presentation_rules.txt` - Presentation guidelines

Upload these to test the system.

## Testing

### Run All Tests

```bash
cd backend
pytest tests/ -v
```

### Test Categories

#### Functional Tests (`test_functional.py`)
- Document parsing and storage
- Index rebuild and retrieval
- API schema validation
- Visibility filtering

#### Reliability Tests (`test_reliability.py`)
- Insufficient evidence handling
- Clarification detection
- Conflict detection
- Assignment-specific rule precedence
- TA mode guardrails

### Expected Test Results

| Test Category | Status |
|--------------|--------|
| Document Parser | PASS |
| Database Storage | PASS |
| Schema Validation | PASS |
| Visibility Filtering | PASS |
| Insufficient Evidence | PASS |
| Clarification Detection | PASS |
| Conflict Detection | PASS |
| Precedence Rules | PASS |
| TA Guardrails | PASS |

## Design Principles

1. **Retrieval-grounded**: Only answer from retrieved course materials
2. **Citation-first**: Every answer shows supporting sources
3. **Abstain when uncertain**: Say "could not verify" if evidence is weak
4. **Conservative TA drafts**: Never auto-approve exceptions
5. **Ask clarifying questions**: Don't guess when questions are underspecified
6. **Visibility separation**: Student vs TA modes see different content
7. **Conflict detection**: Detect and surface conflicting policies

## Limitations & Future Work

### Current Limitations
- No support for complex PDF layouts (uses PyMuPDF with PDFPlumber fallback)
- Single course support only
- No user authentication

### Planned Features
- Multiple course support
- Side panel activation only on Brightspace pages
- Source filtering by document type
- Citation click-to-expand
- Export reply draft to clipboard

