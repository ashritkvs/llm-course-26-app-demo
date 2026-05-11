---
slug: 24-parth-pidadi
title: "DocBrain: AI-Powered Document Intelligence Platform"

students:
  - Parth Pidadi

tags:
  - document-qa
  - rag
  - ocr
  - finance
  - llm

category: finance

tagline: Upload financial & legal docs and query them in plain English.

featuredEligible: true

semester: "Spring 2026"

shortTitle: "DocBrain"

studentId: "116237374"

videoUrl: "https://drive.google.com/file/d/1gNF3GzHBZRDrQd5f7GwyoTtwHGiR1Z0k/view?usp=drive_link"

thumbnail: "https://drive.google.com/file/d/1SHbCIgc7q2Zehm18ognIeEbXjeq-jF_q/view?usp=drive_link"

githubUrl: "https://github.com/Parth-Pidadi/docbrain"
---

## Problem

Managing financial and legal documents is tedious — extracting key data from receipts, invoices, bank statements, and contracts requires manual effort and is error-prone. There is no easy way to ask natural-language questions across a personal document library.

## Solution

DocBrain lets users upload documents, automatically classifies and extracts structured data using a hybrid OCR pipeline, and answers natural-language queries via an LLM equipped with six specialized tools — covering spending analytics, vendor analysis, contract review, and more.

## User Flow

- Sign up and log in securely with JWT-based authentication
- Upload financial or legal documents (PDF or image)
- DocBrain auto-classifies each doc (receipt, invoice, bank statement, contract)
- Ask questions in plain English — e.g. "How much did I spend on food in April?"
- View structured answers and spending breakdowns on the analytics dashboard
- Manage your documents (rename or delete) from the document library

## LLM Components

- **Document Classifier** — categorizes uploaded documents into receipts, invoices, bank statements, or contracts using LLaMA 3.3 70B
- **Structured Data Extractor** — parses and extracts key fields (vendor, amount, date, line items) from each document type
- **Tool-Calling Q&A Agent** — routes user queries to one of six specialized tools (spending queries, vendor analysis, transaction retrieval, receipt itemization, contract analysis, semantic search)
- **Semantic Search** — uses BGE embeddings + ChromaDB to retrieve relevant document chunks for open-ended questions

## Tools

- **Frontend:** React 18, Vite, React Router, Recharts, Axios
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
- **LLM:** LLaMA 3.3 70B via Groq API
- **Vector DB:** ChromaDB with BGE embeddings
- **OCR:** Donut (GPU), pdfplumber, Tesseract
- **Hosting:** Railway (backend), Vercel (frontend)
