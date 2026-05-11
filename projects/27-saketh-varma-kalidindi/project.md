---
slug: 27-saketh-varma-kalidindi
title: ToS Guardian Agent
students:
  - Kalidindi Saketh Varma
tags:
  - multi-agent
  - legal
  - OCR
  - RAG
  - consumer-protection
category: finance
tagline: Audit dense banking contracts for hidden fees and predatory clauses.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "ToS Guardian"
studentId:  "116287838"
videoUrl: https://drive.google.com/file/d/162jvgfqKcFeT35QsfFX9hVtb-lyPoUQn/view?usp=drive_link
thumbnail: /thumbnails/27-saketh-varma-kalidindi.png
githubUrl: https://github.com/Zesearch/llm-course-26-app-demo/tree/main/projects/27-saketh-varma-kalidindi/src
---
## Problem

Everyone clicks 'I Agree' on bank contracts without reading them — these documents are intentionally dense, often over 30 pages of complex legalese designed to hide predatory junk fees and unfair legal terms. Manual review is an efficiency bottleneck for consumers and leads to significant financial losses from missed clauses.

## Solution

An automated auditor that scans financial PDFs to instantly red-flag high-risk items like hidden penalties or arbitration clauses. A multi-agent system extracts fee parameters, translates legalese into plain English, and even generates negotiation scripts so users can challenge unfair terms with their bank.

## User Flow

- Drop a banking PDF or snap a photo of a physical contract
- System parses text and identifies red-flag clauses related to fees and penalties
- Dashboard shows a Risk Score (Red / Yellow / Green) and lists specific hidden costs
- System generates a professional chat script for negotiating terms

## LLM Components

- **Information extraction** — Fee Detective Agent extracts fee types, costs, and triggers from unstructured text and images
- **Text transformation** — Legal Translator Agent simplifies legalese via RAG
- **Reasoning** — Negotiation Agent uses tool-calling to generate dispute scripts based on identified risks

## Tools

- **Stack:** Python + Streamlit
- **LLM:** Gemini 1.5 Flash
- **PDF parsing:** pdfplumber, PyPDF2
- **Vibe coding:** Cursor, Gemini Pro