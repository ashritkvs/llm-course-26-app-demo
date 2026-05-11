---
slug: 15-justin-lee
title: ExamProfile AI
students:
  - Justin Lee
tags:
  - education
  - exam-generation
  - rag
  - analytics
  - stem
category: education
tagline: AI-generated STEM practice exams with diagnostic feedback.
featuredEligible: true
semester: "Spring 2026"
shortTitle: "ExamProfile AI"
studentId: "115495917"
videoUrl: ""
thumbnail: /thumbnails/15-justin-lee.jpeg
githubUrl: "https://github.com/justinlee166/ExamReplica-AI"
---
## Problem

Students in quantitative STEM courses often study from scattered materials: lecture slides, homework sets, old exams, review sheets, and handwritten notes. Generic practice questions do not always match how a specific professor writes exams, emphasizes topics, or grades reasoning. As a result, students can spend a lot of time practicing problems that are too broad, too easy, or disconnected from the actual assessment style of their course.

## Solution

ExamProfile AI is a web app that turns course materials into personalized exam preparation. A student creates a workspace, uploads class documents, and the system parses and indexes the content. It then builds a Professor Profile that captures instructor tendencies such as topic emphasis, problem style, difficulty, and common assessment patterns.

Using that profile and retrieved course evidence, the app generates course-specific practice questions and simulated exams. Students can submit answers, receive structured grading with diagnostic explanations, and view concept-level analytics that highlight weak areas. The system can then regenerate targeted practice based on the student's demonstrated mistakes.

## User Flow

- Create an account and open a course workspace
- Upload course materials such as lectures, homework, review sheets, or past exams
- Generate a Professor Profile from the indexed course evidence
- Request a practice exam or targeted set of questions
- Submit answers and receive diagnostic grading with error classifications
- Review concept mastery, performance trends, and recommendations
- Regenerate focused practice for weaker topics

## LLM Components

- **Professor Profile Generator** - uses retrieved course chunks to infer instructor assessment tendencies, topic emphasis, question formats, and difficulty patterns
- **Exam Generation Pipeline** - drafts course-specific questions, validates them, checks novelty against source material, calibrates difficulty, balances answer choices, and assembles the final exam
- **Diagnostic Grader** - evaluates student answers with structured outputs including score, correctness label, explanation, concept label, and error classifications
- **Adaptive Regeneration** - uses analytics and weak-concept signals to create targeted follow-up practice instead of generic review questions
- **Retrieval Layer** - indexes parsed course materials and retrieves relevant context so LLM outputs stay grounded in the uploaded class evidence

## Tools

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Shadcn/ui, Supabase Auth
- **Backend:** Python, FastAPI, Pydantic, Supabase/PostgreSQL
- **LLM:** Gemini 1.5 Flash through Google AI Studio
- **Retrieval:** ChromaDB, LlamaIndex, local hashing embeddings with optional OpenAI embeddings
- **Documents:** Docling-based parsing, chunking, indexing, and PDF export
- **Deployment:** Vercel for the frontend, Render or Railway for the backend, Supabase for database and authentication
