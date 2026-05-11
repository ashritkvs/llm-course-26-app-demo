---
# Fill in all the fields below.
# See projects/00-demo-solha-park/project.md for a completed reference.

slug: 01-aayush-nair
# Your pre-created folder name — exactly as it appears under projects/.
# Example: if your folder is projects/aayush-nair, write: aayush-nair

title: SocraticTutor

students:
  - Aayush Nair
# If multiple authors, add more lines:
#   - Another Name

tags:
  - ai
  - education
  - agentic-ai
  - socratic-tutoring
# 3–5 tags. Lowercase, hyphens only (no spaces, no uppercase).

category: education
# Pick exactly one:
# data-analysis, developer-tools, education, enterprise-tools,
# finance, health, lifestyle, productivity, research, other

tagline: Built to Teach Reasoning, Not Just Solutions

featuredEligible: true
# Set to false only if you don't want your project featured on the home page.


# --- Preset (do not change) ---

semester: "Spring 2026"


# --- Add when you have them; leave as "" otherwise ---

shortTitle: "Socratic Tutor"
# Fill in only if your full title is long (25+ characters).
# Example: "Multi-Agent Meeting Intelligence System" → "Meeting Intelligence"

studentId: "117347641"
# Your 9-digit Stony Brook ID, in quotes. Example: "123456789"
# Used for grading. Not displayed on the site.

videoUrl: "https://drive.google.com/file/d/1HHrckREP82rpWe6hihAEaOqTrdzSVqEs/view?usp=drive_link"
# Google Drive share link to your demo video.
# You can leave this empty in your first PR and add it once your video is ready.

thumbnail: /thumbnails/01-aayush-nair.png
# Upload your thumbnail image to Google Drive and paste the share link here.
# You can leave this empty in your first PR and add it once your image is ready.

githubUrl: "https://github.com/AayushNair10/SocraticTutor"
# Only if you host your project's source code in your own GitHub repo.
---
## Problem

Traditional study tools give students answers directly, which discourages deep thinking and leads to surface-level understanding. Students often memorize solutions without developing the reasoning skills needed to tackle novel problems independently — they pass tests but fail to build lasting conceptual mastery.


## Solution

The Adaptive Socratic Tutor teaches through questions, never answers. It generates Socratic-style quiz questions from any topic, pasted problem, or uploaded PDF, evaluates reasoning quality with an LLM, and automatically shifts difficulty across sessions based on each student's performance — guiding learners to arrive at understanding on their own.


## User Flow

- Log in with Google OAuth and choose a learning mode: enter a topic, paste a problem, or upload a PDF
- The system generates a full batch of Socratic questions in one call, calibrated to your current difficulty level
- Work through each question one at a time, revealing up to three progressive hints if you get stuck
- Submit your answer and receive instant feedback on correctness and reasoning quality (scored 1–5)
- After the quiz, review weak topics identified from your answers and optionally start a focused reinforcement session
- Return for your next session — difficulty automatically adapts based on your prior score


## LLM Components

- **Batch Question Generation** — Gemini generates all Socratic questions for a session in a single call, each with 3 progressive hints, a short concept tag, and a difficulty level; the easy/medium/hard distribution shifts automatically based on prior session accuracy
- **Open-Ended Answer Evaluation** — Gemini evaluates free-text responses for correctness and reasoning quality (scored 1–5) and returns a Socratic follow-up hint when the answer is wrong; MCQ answers are checked deterministically at zero token cost
- **Problem Decomposition** — Gemini breaks a user-pasted problem into 3–6 Socratic reasoning steps, guiding the student through the solution space without ever revealing the answer directly
- **PDF-Based Question Generation** — Gemini ingests extracted PDF text as source material and generates concept-tagged Socratic questions grounded in the document content, with concept tags kept to short 2–5 word labels


## Tools

- **Frontend:** React (Vite), vanilla CSS with CSS custom properties, Recharts
- **Backend:** Python, FastAPI, Uvicorn
- **Database:** Supabase (PostgreSQL) via supabase-py
- **Auth:** Google OAuth → Supabase Auth → signed JWT (24 h)
- **LLM:** Google Gemini (`gemini-2.5-flash`) via `google-genai`
