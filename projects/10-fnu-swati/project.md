---
slug: custiq-360-fnu-swati
title: CustIQ 360° — Customer Intelligence Platform
students:
  - FNU SWATI
tags:
  - banking
  - multi-agent
  - gemini
  - langgraph
  - rag
  - fintech
category: finance
tagline: A multi-agent AI banking dashboard that gives Relationship Managers a unified 360° view of every customer — replacing 30-minute manual lookups with a 2-minute intelligent conversation.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "CustIQ 360°"
studentId: "116778659"
videoUrl: https://drive.google.com/file/d/1pyVciqZ2m9XH-MMB2E39MWU_JwLVi6wy/view?usp=drive_link
thumbnail: https://drive.google.com/file/d/1r2VoVUW_2dykKAhsyI92d1bUBkBgOWsk/view?usp=drive_link
githubUrl: https://github.com/Swati2310/CustIQ-360
---


## Problem

Relationship Managers in banks navigate multiple disconnected core banking modules — CASA (accounts), Lending, Wealth Management, and KYC — spread across different menus and systems. This results in 30+ minutes per customer lookup, missed cross-sell opportunities, delayed KYC onboarding from manual data entry, and no proactive intelligence. RMs react instead of anticipate.


## Solution

CustIQ 360° is an AI-powered banking assistant that gives Relationship Managers a unified, intelligent view of every customer in one place. Instead of navigating menus, an RM can search for a customer, see their complete 360° profile instantly, ask questions in plain English, receive proactive alerts, and get AI-generated product recommendations — all in under 2 minutes.


## User Flow

- RM logs in with a role-based profile (9 global RMs across APAC, EMEA, and AMER)
- Personalized dashboard shows live alert count and portfolio stats
- Search any customer by name, phone, or email — instantly see their unified 360° profile (Accounts, Loans, Wealth, KYC tabs)
- Ask a natural-language question in the AI Chat (typed or by voice) — response streams in real time
- View ranked cross-sell recommendations with compliance validation per customer
- Check proactive alerts: KYC expiry, FD maturity, churn risk, dormant accounts
- Upload a KYC document image — Gemini Vision extracts structured fields and applies them to the profile in one click
- Run financial simulations: EMI breakdown, FD maturity projection, side-by-side loan comparison


## LLM Components

- **Conversational Query Agent** — Gemini 2.5 Flash with RAG over a FAISS vector index of 95 customer profiles; answers stream back in real time via Server-Sent Events
- **Multi-Agent Router (LangGraph)** — classifies user intent and dispatches to the right specialist node: Query / Recommend / Simulate / Comply / Alert / Fallback
- **Cross-Sell Recommender Agent** — Gemini 2.5 Flash ranks next-best products using LLM reasoning combined with rule-based scoring on segment, income, and existing holdings
- **Compliance Guardrail Agent** — validates every recommendation against KYC status, income eligibility, NPA flags, and risk category before surfacing it to the RM
- **Proactive Alert Engine** — rule-based triggers enriched by LLM-generated alert messages, ranked by severity (HIGH / MEDIUM / LOW)
- **Document Intelligence (Gemini Vision)** — multimodal extraction from KYC document images (Aadhaar, PAN, Passport, Emirates ID, Salary Slip, Property Doc) returning structured JSON with no separate OCR pipeline
- **Semantic Search** — gemini-embedding-001 embeddings stored in FAISS enable natural-language customer search beyond keyword matching


## Tools

- **LLM:** Google Gemini 2.5 Flash (chat, reasoning, vision)
- **Embeddings:** gemini-embedding-001
- **Agent Orchestration:** LangGraph + LangChain
- **Vector Store:** FAISS (faiss-cpu)
- **Backend:** FastAPI, Uvicorn, Python 3.11
- **Frontend:** React 18, Vite, TailwindCSS, Recharts
- **Voice:** Web Speech API (browser-native, no extra packages)
- **Deployment:** Vercel (frontend) + Render (backend)
- **Live Demo:** https://cust-iq-360.vercel.app
