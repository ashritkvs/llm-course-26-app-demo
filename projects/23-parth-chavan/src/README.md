# HeartRisk AI — Run Instructions

## Prerequisites
- Python 3.10+
- Node.js 18+
- A free Gemini API key → [aistudio.google.com](https://aistudio.google.com)

---

## 1. Backend (FastAPI + ML)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and set: GEMINI_API_KEY=your_key_here

# Start the API  (no PYTHONPATH setup needed)
python run.py
```

API runs at **http://localhost:8000**
- Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

> The pre-trained model is included — no training step required.

---

## 2. Frontend (React / Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:5173** and connects to the backend automatically.

---

## Architecture

```
backend/
├── api/          FastAPI routes (predict, auth, report, health)
├── src/          ML pipeline (data processing, model, SHAP, LLM)
├── config/       Settings and logging
├── utils/        Constants, validators, helpers
├── data/
│   ├── models/   Pre-trained stacking ensemble (AUC 0.94)
│   └── processed/ Train/val/test splits + transformers
└── run.py        Entry point

frontend/
├── src/
│   ├── pages/    Landing, Assessment, Results
│   ├── components/
│   └── lib/      API client, types, constants
└── index.html
```

## Key Features
- **ML Model**: Stacking Ensemble (XGBoost + LightGBM + CatBoost + RF + SVM)
- **Explainability**: SHAP feature attribution per prediction
- **LLM**: Gemini 1.5 Flash — streaming explanation + Vision for report upload
- **Auth**: JWT register/login with SQLite prediction history
- **Monitoring**: Prometheus metrics at `/metrics`
