---
slug: 13-huifang-xiang

title: TA Reply Copilot

students:
  - Huifang Xiang

tags:
  - course-assistant
  - retrieval-augmented-generation
  - browser-extension
  - policy-qa

category: education

tagline: A citation-grounded assistant for TA policy replies.

featuredEligible: true

semester: "Spring 2026"

studentId: "117410637"

videoUrl: "https://drive.google.com/file/d/1HqHF4LYP73jIJx-HUlOEXy7Hlc-jPYEX/view?usp=drive_link"

thumbnail: /thumbnails/13-huifang-xiang.png
---
## Problem

TAs often need to answer repeated student questions about course rules, deadlines, late policies, and assignment requirements. It is easy to miss a policy detail or give an answer without clear evidence, especially when information is spread across syllabi, announcements, rubrics, and presentation rules.

## Solution

TA Reply Copilot is a Chrome extension with a FastAPI backend that helps students and TAs ask questions over uploaded course materials. It retrieves relevant evidence, generates citation-grounded answers or TA reply drafts, and abstains when the evidence is weak or conflicting.

## User Flow

- The admin uploads course documents such as syllabi, announcements, rubrics, and presentation rules.
- The system parses the documents, stores metadata, and builds a searchable index.
- A student asks a course-policy question in student mode and receives an answer with citations.
- A TA pastes a student email in TA mode and receives a conservative draft reply with supporting evidence.
- The user checks the evidence status, missing information, or conflict warnings before using the answer.

## LLM Components

- **Retrieval-grounded QA** — finds relevant course document chunks and answers only from retrieved evidence.
- **Citation generation** — attaches source information to each answer so users can verify the policy.
- **TA draft generation** — turns a student email into a polite, policy-correct draft reply for manual review.
- **Evidence status detection** — labels answers as verified, partially supported, insufficient evidence, or conflict detected.
- **Conflict handling** — compares policy rules by specificity, source type, and effective date to surface contradictions.

## Tools

- **Frontend:** Chrome Extension, React, JavaScript
- **Backend:** Python, FastAPI, Pydantic, SQLite
- **Retrieval:** PyMuPDF, FAISS, BM25
- **LLM:** OpenAI API, retrieval-only fallback mode
- **Testing:** Pytest
