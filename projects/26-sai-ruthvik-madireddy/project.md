---
slug: 26-sai-ruthvik-madireddy
title: GetIn.School — AI-Powered College Admissions Counselor
students:
  - Sai Ruthvik Madireddy
tags:
  - education
  - college-admissions
  - full-stack
  - ai-counselor
category: other
tagline: Your personal AI college counselor — get a full admissions strategy in 60 seconds.
featuredEligible: true
semester: "Spring 2026"
shortTitle: GetIn.School
studentId: "116643502"
videoUrl: https://drive.google.com/file/d/1VyOZuEDvtEMV66TF2PoZ4nwExBW79eUe/view?usp=drive_link
thumbnail: /thumbnails/26-sai-ruthvik-madireddy.png
githubUrl: https://github.com/sruthvik/getin-school
---
## Problem

Millions of students apply to college with zero personalized guidance. Professional counselors charge $200-500/hr and most students cannot afford this. First-generation and international students are completely on their own.

## Solution

GetIn.School is a full-stack AI college counselor that costs nothing. Students chat with an AI advisor or upload their resume to get a personalized college list, gap analysis, roadmap, essay draft, scholarship finder, Reddit reviews, and professor search.

## User Flow

1. Student signs up and logs in
2. Chooses Chat mode or Form mode
3. Uploads PDF resume for automatic profile extraction
4. AI advisor collects profile through natural conversation
5. Clicks Generate My Full Analysis
6. Dashboard loads with college list, gap analysis, roadmap, essay, and scholarships
7. Student explores colleges and finds professors at target schools

## LLM Components

- Conversational AI Advisor — Claude Sonnet 4 conducts multi-turn conversation to collect student profile
- Profile Analysis Engine — Claude evaluates 6 factors and generates structured JSON with college matches and roadmap
- Scholarship Matching — Claude suggests real scholarships based on student profile
- Professor Search — Claude identifies real faculty at target universities by department
- Reddit Sentiment Analysis — Claude summarizes Reddit posts via Tavily API into pros, cons, and ratings

## Tools

- Frontend: React, Vite, Tailwind CSS
- Backend: Python, FastAPI
- LLM: Claude Sonnet 4 (Anthropic API)
- Database: Supabase (PostgreSQL)
- APIs: US College Scorecard API, Tavily API
- Deployment: Vercel (frontend), Railway (backend)
