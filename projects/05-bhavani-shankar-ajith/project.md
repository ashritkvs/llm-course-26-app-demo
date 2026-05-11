---
slug: 05-bhavani-shankar-ajith
title: "PaperTrail: The Research Memory Agent"
students:
  - Bhavani Shankar Ajith
tags:
  - graphrag
  - knowledge-graph
  - research-assistant
  - embeddings
  - pdf
category: research
tagline: A research memory agent with hallucination-free, source-verified citations.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "PaperTrail"
studentId: "116744227"
videoUrl: "https://drive.google.com/file/d/1JU_cyqRnd2OTd5WG0Jf1AEKp_OjcpcvW/view?usp=drive_link"
thumbnail: /thumbnails/05-bhavani-shankar-ajith.png
githubUrl: "https://github.com/abs768/PaperTrail"
---
**Live demo:** [huggingface.co/spaces/abs768/papertrail](https://huggingface.co/spaces/abs768/papertrail)


## Problem

Researchers and students read dozens of papers, but the connections fade weeks later. You might remember a brilliant methodology but forget the exact paper that proposed it. Highlights and notes become scattered across disparate PDFs, and traditional keyword searches fail because they look for exact words rather than conceptual relationships.


## Solution

PaperTrail solves the trust problem that plagues most RAG systems: **every citation is server-verified against the source text before it's shown, and a secondary LLM pass independently fact-checks every claim in the answer**. On top of that verification core, the system ingests PDFs, arXiv links, and freeform notes to automatically build a persistent knowledge graph linking each paper to its authors, methods, datasets, and metrics. Cross-paper questions retrieve the relevant subgraph and return answers grounded in verbatim quotes — with the page number and paper title pulled from chunk metadata, not the LLM, so they cannot be fabricated.


## User Flow

- **Upload** a PDF, drop an arXiv link, or jot down a note.
- **See** the knowledge graph populate as entities and cross-paper links emerge automatically. When papers share a concept (e.g., *masked language model* across BERT and RoBERTa), it collapses into a single node — surfacing real conceptual lineage. In a three-paper test corpus (Attention, BERT, RoBERTa), the layout algorithm naturally placed RoBERTa in the center, correctly inferring that it bridges the other two via shared methods and datasets.
- **Explore** the interactive, color-coded Cytoscape graph to visualize relationships.
- **Interrogate** your research by asking cross-paper questions in natural language.
- **Verify** the answers through citations that pinpoint the exact paper, page number, and supporting quote.


## LLM Components

- **Multi-pass entity extraction:** Scans uploaded papers in overlapping windows to identify key entities. A strict validator drops any entity that does not literally appear in the source text, preventing hallucinations.
- **Query classifier:** Categorizes questions (factual, comparative, exploratory, relational) to route the system toward the optimal retrieval strategy.
- **Grounded answer generator:** Produces answers with exact citations. The LLM emits each citation as `(passage_idx, verbatim quote)`; the server then verifies that the quote literally exists in the cited passage before displaying it, pulling page numbers directly from the chunk metadata.
- **Faithfulness verifier:** A secondary LLM pass performs a fact-checking pass on the generated answer. It bounds the system's confidence by flagging any substantive claim that lacks explicit support from the retrieved passages.


## Engineering Rigor

LLM-based extraction is noisy by default; a naïve pipeline produces wrong author lists, hallucinated methods, and citation leakage. PaperTrail layers four deterministic safeguards on top of the LLM to make extraction robust:

- **References-section stripping** removes the bibliography before extraction, so cited paper titles and citation author lists never enter the entity graph.
- **Citation-pattern filter** catches inline citations (`Smith et al., 2018`, `Howard and Ruder`, bare year-stripped two-author forms) that would otherwise pollute the authors list.
- **Multi-token author validator** drops single-token "authors" like *OpenAI* or *Google* that the LLM occasionally picks up from comparison/related-work mentions.
- **Title grounding check** requires the LLM-emitted paper title to appear verbatim in the source; otherwise the system falls back to PDF metadata, then a font-size heuristic over page 1 (largest non-rotated, non-margin text), then the URL filename. This catches paraphrased titles even when the LLM "extracts" something plausible-sounding.

Each safeguard was added in response to a concrete failure mode observed during integration testing — not designed in advance.


## Tools

- **Frontend:** React, Vite, Cytoscape.js
- **Backend:** FastAPI, NetworkX, ChromaDB, rank-bm25, sentence-transformers, PyMuPDF
- **LLM:** Groq `llama-3.3-70b-versatile` (primary), Google Gemini 2.5 Flash (fallback)
- **Hosting:** Single-container Docker on Hugging Face Spaces


## System Design

![PaperTrail architecture](./architecture.png)

The system relies on two primary pipelines sharing persistent state within a single FastAPI container.

**The Ingestion Pipeline**

- **Parse & Chunk:** PyMuPDF extracts text while preserving page numbers, then a paragraph-aware splitter packs it into ~400-word chunks for indexing.
- **Extract & Validate:** The LLM scans for entities, and a validator drops any entity whose surface form does not literally appear in the source text.
- **Populate:** Surviving entities build the Knowledge Graph (NetworkX), while text chunks feed the Vector Store (ChromaDB) and BM25 Index.

**The Query Pipeline**

- **Classify & Traverse:** The system categorizes the user's question and pulls a 2-hop subgraph around the relevant entities.
- **Retrieve:** BM25 and vector searches run in parallel, fusing results via Reciprocal Rank Fusion (with an optional cross-encoder reranker on the top candidates).
- **Generate & Verify:** The LLM drafts a citation-heavy answer; every quote is checked to confirm it literally appears in its source chunk before being shown.
- **Audit:** A final faithfulness check scores the answer's claims against the retrieved passages, bounding the user-visible confidence before the result is returned.
