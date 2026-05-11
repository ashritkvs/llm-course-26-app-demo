---
slug: 22-parag-bharatbhai-patel
title: Intelligent IT Ticket Resolver
students:
  - Parag Bharatbhai Patel
tags:
  - ai
  - multiagent
  - it-support
  - autogen
  - azure
category: other
tagline: A multi-agent AI system that instantly resolves IT support tickets and auto-escalates unresolved issues.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "IT Ticket Resolver"
studentId: "116652722"
videoUrl: https://drive.google.com/file/d/1MWdwoD9lp0nA_9aJIqwtAjbTWfqoXa-j/view?usp=drive_link
thumbnail: /thumbnails/22-parag-bharatbhai-patel.png
githubUrl: https://github.com/parag1912/IT_Ticket_Master
---
## Problem

IT support teams are overwhelmed with repetitive, low-complexity tickets that could be resolved automatically. Employees face long wait times for help with common issues like password resets, network connectivity problems, and software bugs — reducing productivity and increasing operational costs. There is no intelligent triage layer to distinguish solvable issues from those that truly need human intervention.


## Solution

Intelligent IT Ticket Resolver is a multi-agent AI platform built with Microsoft AutoGen and Azure OpenAI. Users submit their IT issue through a Streamlit web interface, and three specialized AI agents collaborate to resolve it:

1. A **Classifier Agent** identifies the category of the issue (Password Reset, Network Issue, Software Bug, Access Request, Hardware Issue, or Other).
2. A **Knowledge Base Agent** performs vector similarity search across a curated solution database to retrieve the top matching resolutions.
3. A **Notification Agent** automatically creates a support ticket and sends an escalation email when the suggested solution is marked unhelpful — ensuring no issue is left unresolved.


## User Flow

- User opens the Streamlit web app and types a description of their IT problem
- The Classifier Agent categorizes the issue automatically
- The Knowledge Base Agent retrieves the most relevant pre-built solutions using vector search
- The user reviews the suggested solution and rates whether it resolved their issue
- If the solution is unhelpful, the Notification Agent escalates the ticket via email to IT support
- User receives confirmation that a human agent will follow up


## LLM Components

- **Classifier Agent** — GPT-4 (Azure OpenAI) with a structured system prompt to map free-text issue descriptions to one of six predefined IT categories
- **Knowledge Base Agent** — GPT-4 backed by Azure Cognitive Search; uses `text-embedding-3-small` embeddings and HNSW vector similarity to retrieve the top-3 matching solutions from a curated knowledge base of 18+ IT resolutions
- **Notification Agent** — GPT-4 agent that formats a structured escalation message and triggers an SMTP email when the automated solution fails to satisfy the user
- **GroupChatManager** — AutoGen orchestrator that coordinates the three agents in a sequential conversation loop (max 6 rounds) and terminates cleanly on resolution or escalation


## Tools

- **Frontend:** Streamlit, custom CSS
- **Agent Framework:** Microsoft AutoGen (ag2 0.9.7)
- **LLM:** Azure OpenAI — GPT-4 (chat), text-embedding-3-small (embeddings)
- **Vector Search:** Azure Cognitive Search with HNSW indexing
- **Escalation:** Python smtplib for automated email notification
- **Data:** JSON knowledge base with 18+ categorized IT problem-solution pairs
- **Hosting / Cloud:** Microsoft Azure
