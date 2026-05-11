---
slug: 31-sanskruti-dhananjay-deshmukh
title: FridgeRAG_Smart_Fridge_Recipe_Assistant
students:
  - Sanskruti Dhananjay Deshmukh
tags:
  - demo
  - example
  - preview
category: other
tagline: An example project to preview the showcase site layout.
featuredEligible: true

semester: "Spring 2026"

shortTitle: ""
studentId: "117372407"
videoUrl: https://drive.google.com/file/d/1Zbv3yhvTvxOKic1ozhD3sTPt0wjY_0Jc/view?usp=drive_link
thumbnail: https://drive.google.com/file/d/1SF5c7OI8aFLgL--x4mgzBroUDoiRE1Uv/view?usp=drive_link
githubUrl: https://github.com/emergingsana123/FridgeRAG_Smart_Fridge_Recipe_Assistant
---

# FridgeRAG — Smart Fridge Recipe Assistant

A small assistant that helps you manage fridge contents, track expiry, and suggest recipes using a Retrieval-Augmented Generation (RAG) approach.

Features
- Track fridge items and expiry alerts.
- Suggest recipes based on current ingredients.
- Simple HTTP API and a bot interface for interaction.

Repository layout
- `fridgerag/` — main application package
	- `run.py` — application entrypoint
	- `api/` — FastAPI (or similar) HTTP routes
		- `routes/fridge.py` — fridge endpoints
		- `routes/cook.py` — recipe/cooking endpoints
		- `routes/receipt.py` — receipt/ingestion endpoints
	- `bot/` — bot entrypoint and commands
	- `data/fridge.json` — sample fridge data store
	- `services/` — integrations (Gemini, Groq, store)
	- `scheduler/expiry_alert.py` — scheduled expiry alerts

Quick start

Prerequisites
- Python 3.10+ recommended
- Create a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r fridgerag/requirements.txt
```

Run the app (development)

```bash
cd fridgerag
python run.py
```

Notes: on Windows use the provided `start.ps1`/`stop.ps1` scripts.

API
- The HTTP API is defined under `fridgerag/api/`. Check `fridgerag/api/routes/` for endpoints:
	- Fridge management: `fridgerag/api/routes/fridge.py`
	- Cooking/recipe: `fridgerag/api/routes/cook.py`
	- Receipt ingestion: `fridgerag/api/routes/receipt.py`

Bot
- The bot implementation lives in `fridgerag/bot/bot.py` with commands in `fridgerag/bot/commands/`.
- Use the bot to add/remove items and request recipes interactively.

Data
- `fridgerag/data/fridge.json` is a small JSON store used by the app. Back this up before clearing or editing manually.

Services & configuration
- Integrations live in `fridgerag/services/`. Some services (e.g., Gemini, Groq) may require API keys or environment configuration — consult the service modules for expected environment variables.

Development
- Follow the Quick start steps to set up the environment.
- Add new endpoints under `fridgerag/api/routes/` and corresponding tests.

Contributing
- Open an issue or submit a PR with a clear description of your change.

License
- No license specified. Add a `LICENSE` file if you intend to open-source this project.

Troubleshooting & next steps
- If you run into missing keys for external services, check `fridgerag/services/` for environment variable names.
- To add unit tests, create a `tests/` folder and run them with `pytest`.

Contact
- For questions or pairing help, ask in the repository or open an issue.