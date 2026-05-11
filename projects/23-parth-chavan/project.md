---
slug: 23-parth-chavan
title: HeartRisk AI — Explainable Heart Disease Risk Prediction
shortTitle: HeartRisk AI
students:
  - Parth Chavan
tags:
  - health
  - explainable-ai
  - machine-learning
  - llm
  - fastapi
category: health
tagline: Predict heart disease risk with ML, explained in plain English by AI.
featuredEligible: true
semester: "Spring 2026"
videoUrl: https://drive.google.com/file/d/1rfAXdzpaEuyyvetCQqYYLB5-JQVj1AMO/view?usp=drive_link
thumbnail: /thumbnails/23-parth-chavan.png
githubUrl: https://github.com/Parthchavann/heart-disease-risk-prediction
---
## Problem

Heart disease is the leading cause of death globally, yet most people have no idea of their personal risk until symptoms appear. Standard risk tools give a number with no explanation, leaving patients confused about what to change and what questions to ask their doctor.

## Solution

HeartRisk AI combines a stacking ensemble ML model (ROC-AUC 0.94) with SHAP explainability and Gemini LLM integration to produce a full risk assessment — including which specific health factors are driving the risk and personalised, plain-English lifestyle recommendations — through a modern React frontend.

## User Flow

- User opens the React app and fills in 13 clinical indicators (age, cholesterol, blood pressure, etc.)
- Optionally uploads a blood test PDF or lab image — Gemini Vision extracts values and auto-fills the form
- Submits the form; the FastAPI backend runs the stacking ensemble model and generates SHAP feature attributions
- Results page shows a risk gauge (Low / Moderate / High), SHAP bar chart of contributing factors, and a streaming Gemini explanation with lifestyle recommendations
- User can register/login to save predictions and view a history trend over time
- Authenticated users can download a PDF report to share with their doctor

## LLM Components

- **Gemini Vision (multimodal)** — reads uploaded blood test PDFs and lab images, extracts clinical values, auto-fills the assessment form
- **Gemini 1.5 Flash (streaming)** — generates patient-friendly risk explanations and personalised lifestyle recommendations streamed token-by-token via SSE
- **SHAP + LLM fusion** — top SHAP risk factors are passed as context to the LLM so the explanation directly references what drove the prediction
- **LLM response caching** — 1-hour TTL cache keyed on risk level + top-3 features eliminates redundant API calls

## Tools

**Frontend**
- React 18, Vite, TypeScript
- Tailwind CSS, shadcn/ui, Recharts, Framer Motion
- EventSource (SSE) for streaming LLM output

**Backend**
- FastAPI, Uvicorn, Python 3.11
- Scikit-learn, XGBoost, LightGBM, CatBoost (stacking ensemble)
- SHAP for feature attribution
- SQLAlchemy + SQLite for user auth and prediction history
- JWT authentication (python-jose + passlib)
- Prometheus + Grafana for monitoring

**LLM**
- Google Gemini 1.5 Flash (text generation, streaming)
- Google Gemini Vision (medical report extraction)
- google-genai SDK
