---
slug: 30-sanjyot-amritkar
title: State-Aware Adaptive Fitness

students:
  - Sanjyot Satish Amritkar

tags:
  - ai-fitness
  - burnout-tracking
  - adaptive-workouts
  - llm-applications
  - personalized-health

category: health

tagline: AI-powered fitness plans that adapt to burnout and energy levels.

featuredEligible: true

semester: "Spring 2026"

shortTitle: "Adaptive Fitness"

studentId: ""

videoUrl: "https://drive.google.com/file/d/1VUbPFBW-tvd1I7j4cGm3f4G4bQe10IhY/view?usp=drive_link"

thumbnail: /thumbnails/30-sanjyot-amritkar.png

githubUrl: "https://github.com/SanjyotAmritkar"
---
## Problem

Most fitness applications assume users can consistently maintain the same workout intensity and schedule. However, factors such as stress, low energy, burnout, and poor recovery significantly impact workout readiness and overall well-being.

This project explores how fitness planning can become more adaptive and human-centered by incorporating burnout awareness into workout generation.


## Solution

State-Aware Adaptive Fitness is an AI-powered fitness web application that dynamically adjusts workout recommendations based on a user’s current mental and physical state.

The system combines onboarding preferences, burnout check-ins, and LLM-generated insights to create personalized workout plans that adapt workout intensity, recovery focus, and exercise structure according to user well-being.


## User Flow

- Users complete an onboarding flow with fitness level, workout goals, and available equipment.
- Users submit weekly burnout check-ins including sleep, stress, energy, social connection, and enjoyment levels.
- The system analyzes burnout trends and generates personalized wellness insights.
- Users generate adaptive workout plans based on burnout state, workout duration, difficulty, and equipment.
- The application dynamically adjusts workout intensity and recovery recommendations.
- Users track generated plans and review historical burnout insights through the dashboard.


## LLM Components

- **Burnout Insight Generation** — uses LLM-powered reasoning to generate contextual burnout summaries and wellness recommendations.

- **Adaptive Workout Personalization** — dynamically adjusts workout structure, recovery emphasis, and intensity based on user state.

- **Trend Interpretation** — analyzes recent burnout check-ins to identify improving, stable, or worsening patterns.

- **Context-Aware Recommendations** — generates personalized recovery and workout guidance tailored to user inputs.


## Tools

- **Frontend:** React, Vite, Tailwind CSS

- **Backend:** Python, FastAPI

- **LLM:** Claude API

- **Deployment:** Vercel, Render

- **Version Control:** Git, GitHub