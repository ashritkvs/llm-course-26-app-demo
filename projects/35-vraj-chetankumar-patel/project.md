---
slug: 35-vraj-chetankumar-patel
title: FixFlow
students:
  - Vraj Chetankumar Patel
tags:
  - property-management
  - maintenance
  - workflow-automation
  - contractor-vetting
  - ai-agents
category: enterprise-tools
tagline: AI-powered maintenance triage and contractor dispatch for landlords.
featuredEligible: true

semester: "Spring 2026"

shortTitle: ""
studentId: "117629031"
videoUrl: "https://drive.google.com/file/d/1wlyb6DIxHKFIBbuOpw3bHAsm-7O7wqoV/view?usp=sharing"
thumbnail: /thumbnails/35-vraj-chetankumar-patel.png
githubUrl: "https://github.com/goffycoder/FixFlow"
---
## Problem

Property maintenance is often slow and manual for both tenants and landlords. Tenants may struggle to describe issues clearly, while landlords must spend time diagnosing the problem, finding contractors, checking their credibility, estimating costs, and deciding whether to approve the repair. This creates delays, inconsistent decisions, and extra operational overhead.

## Solution

FixFlow is an AI-powered property maintenance assistant that streamlines the end-to-end repair workflow. A tenant submits a maintenance request with a photo and optional description. The system uses an LLM to diagnose the issue, classify urgency, recommend actions, discover nearby contractors, vet the top options, estimate repair costs, and generate a work order. Landlords can then review the request in a dashboard and approve or dispatch repairs more efficiently.

## User Flow

- A tenant signs in and submits a maintenance request with a photo and optional text description.
- The system analyzes the photo and generates a structured diagnosis, including severity, urgency, category, and recommended action.
- FixFlow finds relevant nearby contractors based on the issue type and property location.
- The top contractors are vetted using web-grounded information such as reviews, complaints, and estimated local repair costs.
- The system generates a work order and assigns a recommended contractor.
- The landlord reviews the request in the dashboard and approves or dispatches the repair.

## LLM Components

- **Photo-based diagnosis** — analyzes a maintenance photo and description to identify the issue, severity, urgency, and recommended action.
- **Contractor discovery** — finds nearby contractors matched to the repair category and location.
- **Contractor vetting** — gathers review summaries, red flags, and estimated cost ranges for the top contractor candidates.
- **Work order generation** — creates a structured, professional work order for dispatch.
- **Communication support** — helps power outbound quote-request workflows through voice or email integrations.

## Tools

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Next.js API routes, TypeScript
- **Database / Storage:** Supabase
- **Authentication:** Clerk
- **LLM:** Google Gemini via Vercel AI SDK
- **Communication:** Twilio, ElevenLabs, Resend
- **Other:** Zod, Google Maps tools
