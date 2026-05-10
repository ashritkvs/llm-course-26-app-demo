---
slug: 28-sakshi-janak-shah
title: MindJournal
students:
  - Sakshi Shah
tags:
  - mental health
  - journaling
  - personalization
  - fastapi
  - react
category: other
tagline: A personalized AI journaling app that analyzes entries, tracks mood trends, and generates weekly reflection strategies.
featuredEligible: true

semester: "Spring 2026"

shortTitle: MindJournal
studentId: ""
videoUrl: https://drive.google.com/file/d/1Vdd6iuA10Mv8urUzUMK53ute4jPqHIMx/view?usp=sharing
thumbnail: https://drive.google.com/file/d/1oUz08nF6HpocAbUBzr3rcdzu76M08d_j/view?usp=sharing
githubUrl: https://github.com/sakshishah12
---


## Problem

Students and young professionals often journal about stress, self-doubt, burnout, and emotional overload, but it is difficult to consistently extract patterns from those entries on their own. A plain notes app stores thoughts, but it does not help users understand emotional triggers, connect those feelings to lifestyle context, or turn repeated reflection into practical next steps.


## Solution

MindJournal is a full-stack AI journaling system that combines a React + TypeScript frontend with a FastAPI backend, SQLite storage, and Gemini-powered analysis. Users create an account, save a personal profile, write daily journal entries, and receive structured emotional analysis with reframes, actions, and reflective prompts. The app also builds a mood dashboard from saved entries and generates weekly strategies based on both journal history and stored user profile context.


## User Flow

- Create an account and sign in
- Fill out a personal profile with stress level, sleep, exercise, social interaction, and other context
- Write a journal entry for a selected date
- Receive AI-generated emotional analysis, reframes, suggested actions, and a reflection prompt
- Review the mood dashboard to see weekly trends and recurring triggers
- Generate a weekly strategy to turn repeated reflections into a practical plan


## LLM Components

- **Entry analysis** - Gemini analyzes each journal entry and returns structured emotional insight, trigger detection, reframes, and action steps
- **Profile-aware prompting** - stored user profile data is injected into prompts so responses reflect lifestyle, habits, and stress context
- **Summaries and recommendations** - backend LLM routes support concise summaries, recommendations, and insight generation
- **Weekly strategy generation** - the app uses recent journal history plus profile context to create a personalized weekly reflection strategy
- **JSON repair and response handling** - the backend includes extra parsing and repair logic to make structured LLM responses more reliable


## Tools

- **Frontend:** React, TypeScript, Vite, CSS
- **Backend:** FastAPI, Python
- **Database:** SQLite
- **Authentication:** session-based auth with token-backed API access
- **LLM:** Google Gemini
- **Data Visualization:** custom SVG charts for mood trends and distribution
