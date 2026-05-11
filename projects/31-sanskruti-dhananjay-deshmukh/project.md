---
slug: 31-sanskruti-dhananjay-deshmukh
title: FridgeRAG_Smart_Fridge_Recipe_Assistant
students:
  - Sanskruti Dhananjay Deshmukh
tags:
  - rag
  - recipe
  - food
  - fastapi
  - groq
  - gemini
category: other
tagline: A RAG-powered assistant that tracks your fridge inventory and suggests recipes based on what you have.
featuredEligible: true

semester: "Spring 2026"

shortTitle: ""
studentId: "117372407"
videoUrl: https://drive.google.com/file/d/1Zbv3yhvTvxOKic1ozhD3sTPt0wjY_0Jc/view?usp=drive_link
thumbnail: /thumbnails/31-sanskruti-dhananjay-deshmukh.jpeg
githubUrl: https://github.com/emergingsana123/FridgeRAG_Smart_Fridge_Recipe_Assistant
---
# FridgeRAG — Smart Fridge Recipe Assistant

A small assistant that helps you manage fridge contents, track expiry, and suggest recipes using a Retrieval-Augmented Generation (RAG) approach.

## Problem

People routinely waste food because they forget what is in their fridge, miss expiry dates, and struggle to come up with recipes from whatever ingredients happen to be on hand. Existing recipe apps require manual ingredient entry and give generic suggestions with no awareness of what you actually own.

## Solution

FridgeRAG maintains a live inventory of fridge contents (populated by scanning receipts or manual entry) and combines a RAG pipeline with LLM-powered reasoning to suggest recipes that use ingredients already in the fridge, flag items nearing expiry, and answer natural-language cooking questions grounded in the current inventory.

## User Flow

1. User adds items to the fridge by uploading a receipt image or calling the `/fridge` API endpoint.
2. The scheduler monitors expiry dates and sends alerts when items are close to expiring.
3. User asks "what can I cook tonight?" via the bot or the `/cook` endpoint.
4. FridgeRAG retrieves the current inventory, constructs a context-rich prompt, and calls the LLM to generate tailored recipe suggestions.
5. User can remove consumed items from the inventory through the bot commands or API.

## LLM Components

- **Recipe generation**: Given the current fridge inventory as context, an LLM generates recipe suggestions that prioritise ingredients closest to expiry.
- **Receipt parsing**: A vision-capable model (Gemini) extracts item names and quantities from uploaded receipt images.
- **Conversational Q&A**: The bot handles free-form cooking questions, grounding answers in the RAG-retrieved inventory context.

## Tools

- **Groq** — fast LLM inference for recipe suggestions and conversational responses
- **Google Gemini** — vision model for receipt OCR and ingredient extraction
- **FastAPI** — HTTP API layer for fridge management and recipe endpoints
- **APScheduler** — cron-style scheduler for expiry alerts
- **JSON file store** — lightweight persistence for fridge inventory (`fridgerag/data/fridge.json`)

## Features

- Track fridge items and expiry alerts.
- Suggest recipes based on current ingredients.
- Simple HTTP API and a bot interface for interaction.

## Repository Layout

- `fridgerag/` — main application package
	- `run.py` — application entrypoint
	- `api/` — FastAPI HTTP routes
		- `routes/fridge.py` — fridge endpoints
		- `routes/cook.py` — recipe/cooking endpoints
		- `routes/receipt.py` — receipt/ingestion endpoints
	- `bot/` — bot entrypoint and commands
	- `data/fridge.json` — sample fridge data store
	- `services/` — integrations (Gemini, Groq, store)
	- `scheduler/expiry_alert.py` — scheduled expiry alerts

## Quick Start

Prerequisites: Python 3.10+

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r fridgerag/requirements.txt
cd fridgerag
python run.py
```

On Windows use the provided `start.ps1` / `stop.ps1` scripts.

## API

- `GET/POST /fridge` — fridge management (`fridgerag/api/routes/fridge.py`)
- `GET/POST /cook` — recipe suggestions (`fridgerag/api/routes/cook.py`)
- `POST /receipt` — receipt ingestion (`fridgerag/api/routes/receipt.py`)

## Bot

The bot lives in `fridgerag/bot/bot.py` with commands in `fridgerag/bot/commands/`. Use it to add/remove items and request recipes interactively.

## Configuration

API keys for Gemini and Groq are read from environment variables. See `fridgerag/.envExample` for the required variable names and `fridgerag/services/` for usage.