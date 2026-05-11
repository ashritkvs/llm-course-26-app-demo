---
slug: 20-omkar-rane
title: "Diff-Scribe: The PR Description Writer"
students:
  - Omkar Rane
tags:
  - developer-tools
  - github
  - pull-request-description
category: developer-tools
tagline: From diff to done — AI drafts your GitHub PR description where you type it.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "DiffScribe"
studentId: "116599159"
videoUrl: "https://drive.google.com/file/d/1a3uonsx-wxIhA03DKlFCESvjv6cjKKVc/view?usp=drive_link"
thumbnail: /thumbnails/20-omkar-rane.png
githubUrl: https://github.com/omkarrane30
---
## Problem

Writing clear pull request descriptions is slow and error-prone. Reviewers need context, risk notes, and testing guidance, but authors often face a large diff and an empty description box. Manually summarizing every file, inferring intent, and keeping tone consistent across internal and open-source workflows takes time that could go into code review itself.


## Solution

**PR Description Writer** is a Chrome extension (Manifest V3) that runs on GitHub **compare** and **new pull request** pages. It gathers the branch **git diff** (via the GitHub compare API when possible, with a DOM fallback), enriches the prompt with **README-first repository context** and a **structured change map**, then calls the **OpenAI Chat Completions API** with **streaming** so markdown appears live in the PR body. Authors choose a **template** (minimal, team, or oss), edit the draft, and submit as usual.


## User Flow

- Install the extension from source with **Load unpacked** in `chrome://extensions` (Developer mode on).
- Open the extension popup, save an **OpenAI API key**, and pick a **description template**.
- Push a branch and open a GitHub **compare** or **pull/new** URL where the PR description field is visible.
- Click **✨ Generate PR Description** and watch the textarea fill via streaming output.
- Revise the markdown (links, rollout notes, reviewer asks), then create or update the pull request.


## LLM Components

- **Chat Completions (streaming)** — `src/background.js` sends system + user messages to OpenAI and forwards token deltas to the active tab.
- **System prompt & section contract** — `src/prompt.js` constrains the model to markdown with fixed headings (What changed, Why, How to test, Notes) and discourages inventing test commands not grounded in the diff.
- **User prompt assembly** — `buildUserPrompt` combines the diff, pre-parsed stats, per-file change map, template style, and optional README/docs excerpts so the model can summarize accurately and flag truncation on very large PRs.


## Tools

- **Extension platform:** Chrome Manifest V3 (service worker, content scripts, `chrome.storage.local`).
- **UI:** HTML/CSS/JS popup (`src/popup.html`, `src/popup.js`); injected controls in `src/content.js` with `styles/content.css`.
- **APIs:** GitHub REST (compare diff, repository contents for context); OpenAI Chat Completions (`https://api.openai.com/v1/chat/completions`).
- **Local checks (optional):** Node.js — `npm run test:diff` runs `scripts/test-diff-workflow.cjs` for diff parsing and prompt structure.
