---
slug: "18-meet-naresh-brahmbhatt"
title: "DeepWrite: The Agentic Planning & Research Engine"
students:
  - "Meet Naresh Brahmbhatt"
tags: ["multi-agent", "langgraph", "nlp", "rag"]
category: "developer-tools"
tagline: "9-node AI pipeline that researches, plans, writes, and fact-checks blogs."
featuredEligible: true
semester: "Spring 2026"
shortTitle: "DeepWrite"
studentId: "117291342"
videoUrl: "https://drive.google.com/file/d/1UsR38H6tjVJFMIPJ9dHWXZYOjvL6B5pF/view?usp=drive_link"
thumbnail: "https://drive.google.com/file/d/1gcT9Vu42t78BLpzFexai7Nr60_hiaue7/view?usp=sharing"
githubUrl: "https://github.com/iMeet07/deepwrite"
---

# DeepWrite: The Agentic Planning & Research Engine

A multi-agent AI pipeline that researches, plans, writes, fact-checks, and SEO-audits a full technical blog post — end to end — in under 90 seconds.

## Problem

Standard AI writing tools suffer from three fundamental limitations:

**The Hallucination Gap** — LLMs write in one sequential pass with no verification step, producing confident-sounding content that is factually wrong. There is no mechanism to cross-reference claims against real sources.

**The Research Wall** — Human writers spend 80% of their time on research and only 20% actually writing. Existing tools ignore research entirely, generating generic content that lacks grounding in real-world data.

**Linear Generation** — Every tool from ChatGPT to Jasper generates content in a single LLM call. This produces shallow, unfocused output because the model must simultaneously manage structure, research grounding, tone, and word count in one shot.

## Solution

DeepWrite is a **9-node LangGraph pipeline** that separates the writing process into specialist agents — the same way a professional newsroom works. Each agent has a single responsibility. No agent tries to do everything.

The key insight: **planning before writing is not enough**. A real writing workflow has nine stages — topic classification, memory retrieval, research, planning, parallel writing with critic review, merging, fact verification, and SEO optimisation. DeepWrite has a dedicated node for each.

## User Flow

1. User enters a topic and clicks **Generate Article**
2. The **Router** classifies the topic — live web research needed, or write from training knowledge?
3. The **Memory** node retrieves past articles from ChromaDB to inject writing style into every section
4. The **Research** node queries Tavily and returns 4–5 grounded evidence items
5. The **Orchestrator** produces a structured plan: title, audience, tone, 4–6 sections with goals and word targets
6. **Parallel Workers** write each section simultaneously — a **Critic agent** scores each on accuracy, depth, clarity, and grounding. Sections below 6.5/10 are sent back for revision
7. The **Reducer** merges all sections into one coherent article
8. The **Fact-Checker** cross-references every claim against evidence with confidence scores
9. The **SEO Audit** scores 0–100, generates a meta description, and flags issues by severity
10. User edits via the **AI Editor** (natural language chat), downloads as Markdown or HTML, or reloads any past draft

## LLM Components

- **Router** — structured output classifying topic as `closed_book`, `hybrid`, or `open_book`
- **Orchestrator** — structured output producing a full section-by-section writing plan
- **Worker agents** — parallel LLM calls writing individual sections with grounding rules and style context
- **Critic agent** — structured output scoring accuracy, depth, clarity, grounding with revision feedback
- **Fact-Checker** — structured output verifying claims against evidence with per-claim confidence scores
- **SEO Auditor** — structured output scoring readability, keyword density, and heading structure
- **AI Editor** — conversational LLM with full article context and 10-turn memory
- **Evidence fallback** — LLM synthesises representative evidence when Tavily is unavailable

## Tools

- **LangGraph** — state machine managing the 9-node pipeline with fan-out/fan-in for parallel workers
- **Groq (Llama 3.3 70B)** — primary LLM; free tier, ~5x faster than GPT-4o
- **Tavily API** — real-time web search with graceful LLM fallback
- **ChromaDB** — local vector store for writer memory
- **sentence-transformers (all-MiniLM-L6-v2)** — local embeddings, no API key required
- **Streamlit** — frontend with live pipeline tracker, AI Editor, and draft history
- **SQLite** — persistent draft history
- **Claude (Anthropic)** — primary vibe-coding assistant throughout development