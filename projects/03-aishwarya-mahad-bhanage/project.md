---
slug: 03-datalineageAI-aishwarya-bhanage
title: DataLineage AI
students:
  - Aishwarya Bhanage
tags:
  - dbt
  - data-engineering
  - debugging
  - langgraph
  - claude
  - aws
category: developer-tools
tagline: An LLM-powered debugging tool for broken dbt data pipelines — diagnoses root cause and suggests corrected SQL in ~4 seconds.
featuredEligible: true
semester: Spring 2026
shortTitle: DataLineage AI
studentId: "116556145"
videoUrl: https://drive.google.com/file/d/1bRiTiioJKlp9P0uUDwJ96YxXG58x3-Ga/view?usp=drive_link
thumbnail: https://drive.google.com/file/d/103iLEA1uymQPKi4RjdVTPytaOC0DexVz/view?usp=drive_link
githubUrl: https://github.com/AishwaryaBhanage/AI-DataLineage
liveUrl: http://datali-Publi-qsZNW7jcIFUB-1558367737.us-east-1.elb.amazonaws.com
---

## Problem

Data engineers using dbt (data build tool) lose 30–60 minutes per failure manually tracing broken pipelines. When a model fails, the warehouse returns a single cryptic error like `Binder Error: Referenced column "amount" not found`, and the engineer must open the failing SQL, identify the missing column, trace upstream through 3–10 dependency layers, and find where the column was renamed, dropped, or never existed. The warehouse only reports one error at a time, so fixing one reveals the next — a frustrating iterative cycle that production dbt teams hit multiple times daily.

Existing tools don't close this gap: dbt CLI shows the error but no root cause; dbt docs visualize lineage but don't reason about column-level issues; ChatGPT can analyze pasted SQL but lacks access to your manifest, lineage, and upstream schemas; data observability tools focus on data quality, not SQL debugging.

## Solution

DataLineage AI combines **lineage awareness** with **LLM reasoning** to automate root-cause analysis for broken dbt models. The user uploads `manifest.json` and `run_results.json` (or pastes a dbt Cloud URL) and clicks Analyze. In ~4 seconds the system returns the root cause, a natural-language explanation, a calibrated confidence score, corrected SQL, affected columns, and validation steps.

The system uses **context engineering** rather than naive tool-calling: deterministic code (sqlglot, regex, networkx) pre-builds a structured evidence packet (broken SQL, error, upstream schemas, lineage path), then a single Claude call reasons over it. This costs ~$0.013 per run vs ~$0.15 for a fully agentic loop. For complex multi-layer failures, an opt-in **agentic mode** runs a ReAct agent with 7 tools that autonomously investigates the lineage graph.

Deployed as a production service on **AWS ECS Fargate** with a React frontend, FastAPI backend, bearer-token auth, per-key rate limiting, structured logging, usage tracking, and CI/CD via GitHub Actions.

## User Flow

1. Open the app and paste an API key in Settings (or use the bundled demo key)
2. On the Debug page, choose a source — drag-and-drop `manifest.json` + `run_results.json`, paste a dbt Cloud job URL, or use the bundled demo project
3. Pick analysis mode — **Fast** (one Claude call, ~4s, ~$0.013) or **Deep / Agentic** (ReAct loop with tools, ~25s, ~$0.15)
4. Click **Analyze** — the lineage DAG renders with the failing model highlighted
5. Read the diagnosis: root-cause banner, explanation, affected columns, ranked hypotheses with confidence bars, side-by-side SQL diff, and validation checklist
6. Copy the corrected SQL or download the JSON report
7. Browse the **Jobs** page to revisit prior analyses, **Usage** for per-key stats, or **Models** to explore upstream/downstream relationships in any manifest

## LLM Components

- **Context engineering** — pre-built evidence packet (SQL, error, upstream columns, lineage) sent in one Claude Sonnet 4 call, keeping latency low and cost predictable
- **Structured output** — strict JSON schema enforced via system prompt (root_cause, explanation, confidence_score, corrected_sql, validation_steps, hypotheses)
- **Chain-of-thought + few-shot prompting** — system prompt instructs step-by-step reasoning and includes a complete worked example
- **Confidence calibration** — explicit rules for 0.95+ / 0.80–0.94 / 0.65–0.79 / <0.65 bands so scores are honest signals, not decoration
- **ReAct agent (agentic mode)** — Claude as coordinator with 7 tools (`ingest_dbt_artifacts`, `analyze_sql`, `analyze_error`, `get_lineage`, `check_columns_available`, `get_model_sql`, `fetch_dbt_cloud_artifacts`) for thought→action→observation loops on complex cases
- **Multi-agent orchestration** — LangGraph `StateGraph` with parallel fan-out (SQL parsing and error parsing run concurrently before merging into LLM analysis)
- **Result caching** — SHA-256 keyed cache (manifest + run_results + model + mode) with 1-hour TTL; effective cost drops to ~$0.013/run at 50% hit rate

## Tools

- **Backend:** FastAPI, LangGraph, LangChain Anthropic, Anthropic SDK (Claude Sonnet 4), sqlglot, networkx, SQLAlchemy (async + aiosqlite), slowapi, structlog, Pydantic
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Axios, React Flow + dagre, React Router, Lucide, Sonner
- **Data:** dbt-core 1.8 with dbt-duckdb adapter (bundled demo project), dbt Cloud REST API integration
- **Infrastructure:** Docker (multi-stage), AWS ECS Fargate, ALB, ECR, SSM Parameter Store, CloudWatch Logs, AWS Copilot CLI
- **CI/CD:** GitHub Actions (pytest on PR, build + push + deploy on merge to main)
- **LLM:** Claude Sonnet 4 via Anthropic API
