---
slug: 08-dhruv-rathee
title: "CodeStory: AI-Powered Git Archaeology"
students:
  - Dhruv Rathee
tags:
  - git-history
  - code-archaeology
  - developer-tools
  - llm-narrative
category: developer-tools
tagline: Explains why code exists by tracing blame, commits, and GitHub context.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "CodeStory"
studentId: "116633028"
videoUrl: "https://drive.google.com/file/d/1bFvYFgrMZb0mull7C-S4-7jJwPyTUhZr/view?usp=sharing"
thumbnail: /thumbnails/08-dhruv-rathee.png
githubUrl: "https://github.com/12-crypto"
---
## Problem

When developers inherit unfamiliar code, the hardest question is usually not what it does, but why it exists. `git blame` reveals who changed a line and when, but not the reasoning behind the change. That leaves onboarding, debugging, and maintenance dependent on tribal knowledge buried across commits, issues, and pull requests.


## Solution

CodeStory turns raw git history into a readable story. The system analyzes blame, commit history, and linked GitHub context, then uses Llama 3.2 to generate a narrative that explains a function's origin, refactors, bug fixes, and current shape. An interactive timeline makes the evolution of the code easy to scan and share.


## User Flow

- The user opens CodeStory on a confusing repository, file, or function
- The user enters the repo path, file path, and function name
- The backend traces the file history, gathers blame data, and pulls related GitHub context
- The LLM generates a narrative and timeline from the collected evidence
- The frontend displays the story, commit timeline, and linked issues or pull requests
- The user immediately understands what changed, why it changed, and who to ask next


## LLM Components

- **History Tracer** — walks the commit history for the target file and extracts relevant changes
- **Context Gatherer** — collects related GitHub issues and pull requests for additional reasoning
- **Story Generator** — produces the final narrative and timeline summary from all collected evidence


## Tools

- **Frontend:** React, Vite, HTML/CSS
- **Backend:** Python, FastAPI, PyGit2
- **LLM:** Llama 3.2 via Ollama or Groq
- **APIs:** GitHub REST API
