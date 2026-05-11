---
slug: 12-harshith-pabbati
title: "Answerify: AI-Powered Customer Support Platform"
students:
  - Harshith Pabbati
featuredEligible: true
tags:
  - customer-support
  - ai
  - rag
  - automation
  - email-automation
  - workflow-automation
  - enterprise-tools
  - llm
  - saas
category: enterprise-tools
tagline: AI customer support that drafts, cites, and automates high-quality email replies so your team solves what really needs a human.
semester: "Spring 2026"
shortTitle: "Answerify"
studentId: "117383449"
videoUrl: "https://drive.google.com/file/d/1_cdhe749LqFsq1arTy96DwXHzbHlFUXQ/view?usp=drive_link"
thumbnail: /thumbnails/12-harshith-pabbati.png
githubUrl: "https://github.com/harshithpabbati/answerify"
---
## Problem

Customer support teams lose time answering repetitive emails, searching scattered documentation, and manually triaging tickets. For small and scaling teams, keeping up with high ticket volumes is overwhelming, leading to slower responses and inconsistent quality. Outsourcing routine replies to AI risks ungrounded, hallucinated responses that break customer trust.

## Solution

Answerify is an AI support workspace that connects to your documentation, prior replies, and live tool data. It automatically classifies intents, retrieves knowledge and business data, and generates grounded, cited HTML replies to email tickets. Responses above a confidence threshold are auto-sent; others become drafts for human review. Edited/approved replies update the knowledge base, so Answerify’s precision improves with use.

## User Flow

- Create an organization workspace and connect a shared support inbox.
- Add URLs, docs, FAQs, and internal resources; Answerify embeds and indexes these into a queryable knowledge base.
- Incoming emails are received via webhook integration (Cloudflare Email Routing) and automatically routed and tagged by intent (billing, bug, refund, etc.).
- The system queries indexed docs and optionally external MCP tools to retrieve the context needed for a reply.
- Drafted responses with citations are generated using Gemini (RAG + embeddings); high-confidence replies are sent, others are queued for review.
- Agents review, edit, and approve; each approval updates the knowledge base, improving future reply quality.
- Workflow automation allows teams to define routing, escalation, tone, and autopilot/approval thresholds.
- Role-based access (Member/Admin/Owner) ensures security with Supabase Auth + RLS.

## LLM Components

- **Intent detection:** Classifies tickets into fine-grained support categories with Gemini.
- **Retrieval-augmented generation (RAG):** Embeds and searches indexed docs (via pgvector on Supabase/Postgres), expands relevant context, and generates HTML replies with inline citations.
- **Confidence-based autopilot:** Sends replies automatically or drafts them for human review based on retrieval + model confidence (tunable threshold).
- **MCP Tool Augmentation:** Before replying, queries external MCP servers for up-to-date business data (orders, subscriptions, etc.).
- **Learning loop:** Human-approved replies are indexed and re-embedded, so repeated issues get better answers over time.

## Tools

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Radix UI, Tiptap
- **Backend:** Next.js App Router, Supabase (Postgres + Realtime + Row Level Security, PLpgSQL for triggers/rules), Cloudflare Email Routing, Google Gemini 2.5 Flash (LLM), Gemini Embeddings, MCP integration
- **AI Infra:** pgvector for semantic search, Supabase Realtime, Cloudflare AI Gateway for rate-limiting, caching, and observability
- **Security & Access:** Supabase Auth, role-based RBAC (Member/Admin/Owner), fine-grained row-level security (RLS)

---

> Answerify offers secure, scalable, and deeply configurable AI support automation ideal for SaaS, enterprise, and fast-growing teams that want grounded replies, higher agent productivity, and continuous improvement of knowledge over time.
