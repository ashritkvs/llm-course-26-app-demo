---
slug: 17-krupesh-rajendrakumar-desai
title: "UniFlow: AI-Powered Unified Course Workspace"
students:
  - Krupesh Desai
tags:
  - education
  - productivity
  - ai-assistant
  - course-management
  - llm
category: education
tagline: "Unified AI workspace for course tasks, resources, feedback, and deadlines."
featuredEligible: true

semester: "Spring 2026"
shortTitle: "UniFlow"
studentId: "117623888"
videoUrl: "https://drive.google.com/file/d/16Vakmbftz2nr0c1_rspHN0cyjL9nIle_/view?usp=drive_link"
thumbnail: /thumbnails/17-krupesh-rajendrakumar-desai.png
githubUrl: ""
---
## Problem

In AMS 691, students need to manage many course-related tasks across different platforms. Announcements may appear in Brightspace, discussions may happen in Discord-style channels, resources may be shared through Google Drive, assignments may require GitHub submission, and students also need to submit feedback after classmates' presentations.

Because these tasks are scattered, students can easily miss deadlines, lose important links, or forget required feedback. This creates unnecessary stress for students and also makes course coordination harder for the instructor.

## Solution

UniFlow is an AI-powered unified course workspace that brings announcements, collaboration messages, resources, assignments, tasks, and presentation feedback into one place.

Instead of switching between many platforms, students can use UniFlow as a central command center for the course. The app summarizes course information, extracts tasks and deadlines, checks missing resources, supports discussion-style collaboration, and helps students generate polished peer feedback.

The goal is to help future AMS 691 students stay organized and also show how an instructor could use a unified AI workspace to reduce the coordination burden across multiple tools.

## User Flow

- The user starts from the dashboard and sees pending tasks, high-priority items, announcements, collaboration messages, resources, and assignments.
- The user can load demo AMS 691 data or create a custom course workspace.
- In the Announcement Center, the user can add or import course announcements.
- In the Collaboration Hub, students can post reminders, questions, and shared experiences.
- In the Resource Manager, students can track important links such as demo videos, thumbnails, project files, slides, and reports.
- In the Assignment Tracker, students can manage submissions and deadlines.
- The Tasks page converts workspace data into actionable items.
- The AI Assistant answers questions such as “What should I complete this week?”
- The Feedback Helper helps students write clear presentation feedback with a best part and an improvement suggestion.

## LLM Components

- **Announcement summarization** — summarizes course updates into concise action points.
- **Task and deadline extraction** — identifies required submissions, deadlines, and high-priority work.
- **Workspace question answering** — answers questions using the current course workspace data.
- **Discussion summarization** — summarizes collaboration messages and student reminders.
- **Resource completeness checking** — identifies missing or incomplete resource links.
- **Weekly planning** — creates a prioritized action plan for the student.
- **Feedback polishing** — turns rough peer review notes into respectful structured feedback.

## Tools

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **LLM:** Optional OpenAI or Anthropic API support
- **Prototype storage:** localStorage
- **Development:** Replit Agent
- **Fallback logic:** rule-based analyzer for demo reliability without API keys

## Limitations

This prototype uses demo data, manually added course information, and localStorage. It does not currently connect directly to Brightspace, Discord, Google Drive, GitHub, or Google Forms APIs.

## Future Work

Future versions could add real platform integrations, user authentication, multi-user collaboration, cloud database storage, calendar reminders, automatic LMS synchronization, and instructor-side course management features.
