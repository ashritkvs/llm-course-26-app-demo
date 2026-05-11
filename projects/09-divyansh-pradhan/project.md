---
slug: finsight-ai-divyansh
title: FinSight AI
students:
  - Divyansh Pradhan
tags:
  - finance
  - multimodal
  - rag
  - agentic
category: productivity
tagline: An autonomous, multimodal financial tracker with RAG-powered advisory and dual-layer security.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "FinSight"
studentId: "116740780"
videoUrl: "https://drive.google.com/file/d/1-93NTC-n3hGwGv0aa9awQ117i-dabzeQ/view?usp=drive_link"
thumbnail: "https://drive.google.com/file/d/1B5o1c7VpyXtdGqK0Wsv-r_S674fKtylE/view?usp=drive_link"
githubUrl: "https://github.com/Divyansh1414/finsight-ai"
---

## Problem

Manual expense tracking is the number one reason people fail at personal budgeting. Existing financial applications require tedious manual entry of categories, amounts, and dates, leading to "data fatigue" and abandoned trackers. Without consistent logging, users lack the actionable data needed to make informed financial decisions.


## Solution

FinSight AI is an enterprise-grade, full-stack personal finance application that elevates tracking from manual entry to autonomous data extraction. By utilizing Multimodal Context Fusion, users can provide a photo of a receipt alongside a simultaneous voice note. The system synthesizes these unstructured inputs into a structured ledger, secured by robust dual-layer TOTP authentication, and displays the data via a real-time reactive dashboard.


## User Flow

- **Secure Login:** Authenticate via a Time-Based One-Time Password (Google Authenticator) or a live HTML-templated email fallback.
- **Multimodal Logging:** Upload a receipt and speak into the microphone (e.g., "Business lunch with the team") on the Agentic Tracker page. 
- **Auto-Fill & Save:** Watch the AI instantly parse the context into structured JSON (amount, date, category) and save it to the Implied-UTC SQLite database.
- **Real-Time Visualization:** Navigate to the Dashboard to see charts instantly update with the new cash burn and category footprints.
- **RAG Advisory:** Ask complex questions about spending habits in the Chat interface and receive highly specific, context-aware advice pulled from past transactions.


## LLM Components

- **Multimodal Extraction Agent:** Feeds simultaneous image (vision) and audio-transcript (text) inputs into Google Gemini 2.5 Flash to synthesize missing context and output strict JSON structures.
- **Intelligent Query Router:** A custom LLM classifier that dynamically evaluates user prompts and routes them to either a FAISS-powered RAG pipeline (for ledger analysis) or a general LLM pipeline (for broad advice).
- **RAG Advisory Agent:** Executes semantic searches over the user's FAISS vector index, utilizing persistent SQLite relational chat tables to maintain multi-turn conversational memory across sessions.


## Tools

- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Framer Motion, Chart.js
- **Backend:** Python, Flask, SQLite (Implied-UTC Architecture)
- **AI Engine:** Google Gemini 2.5 Flash
- **Vector Search:** FAISS (Facebook AI Similarity Search)
- **Security:** PyOTP (Time-based Auth), smtplib (SMTP Email Verification)
