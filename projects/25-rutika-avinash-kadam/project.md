---
slug: 25-rutika-avinash-kadam

title: Decoding SAS

students:
  - Rutika Avinash Kadam

tags:
  - research
  - data-analysis
  - rag
  - privacy
  - llm

category: research

tagline: Turn raw SAS outputs into plain-English insights, privately.

featuredEligible: true

semester: "Spring 2026"

shortTitle: ""

studentId: "116753960"

videoUrl: "https://drive.google.com/file/d/192tbcyevu4LdEVng_V4A-CWE5McyFzp_/view?usp=drive_link"

thumbnail: /thumbnails/25-rutika-avinash-kadam.png

githubUrl: "https://github.com/RutikaKadam10/decoding_sas_project"
---
## Problem

Researchers working with SAS statistical models are often technically proficient — capable of writing and executing models — but lack the domain knowledge to interpret complex outputs. Existing public AI tools like ChatGPT or Gemini can help, but sensitive research data cannot be shared with public interfaces due to privacy and confidentiality concerns.


## Solution

Decoding SAS is a private, web-based AI application that lets researchers upload SAS output files and receive plain-English summaries and interpretations through a secure pipeline. It uses RAG (Retrieval-Augmented Generation) to incorporate study-specific variable definitions from an uploaded data dictionary, and maintains full conversation memory for context-aware follow-up questions — all without exposing data to any public interface.


## User Flow

- Optionally upload a data dictionary or codebook — it is chunked, embedded, and indexed into a local FAISS vector store
- Upload a SAS output file (PDF, image, Excel, or DOCX)
- Click "Summarise" to get an instant plain-English summary with relevant variable context retrieved via RAG
- Click "Ask Question" to ask anything about the output — follow-up questions retain full conversation memory
- Export the complete Q&A session as a formatted PDF report
- Click "Reset Session" to clear all files, history, and indexed data


## LLM Components

- **GPT-4o (OpenAI)** — powers summarisation, question answering, and vision-based interpretation of image inputs
- **text-embedding-3-small (OpenAI)** — embeds data dictionary chunks for semantic similarity search
- **RAG Pipeline (LangChain + FAISS)** — retrieves relevant variable definitions from the indexed data dictionary and injects them into the prompt automatically
- **Conversation Memory** — full message history passed to the API on each request, enabling context-aware follow-up questions
- **Custom System Prompt** — instructs the model to interpret SAS outputs, match variable names using partial/fuzzy logic, and explain results in plain English


## Tools

- **Frontend:** React, TypeScript, react-markdown, jsPDF, CSS Variables (light/dark mode)
- **Backend:** Python, FastAPI, uvicorn
- **LLM:** GPT-4o via OpenAI API, LangChain, FAISS, text-embedding-3-small
- **File Parsing:** PyMuPDF, pandas, openpyxl, python-docx
- **Package Manager:** uv
