---
slug: 07-devshree-hardiksinh-jadeja
title: "DiagRAG: Multi-Modal AI Diagnostic Engine"
students:
  - Devshree Hardiksinh Jadeja
tags:
  - ai
  - healthcare
  - rag
  - gnn
category: healthcare
tagline: "A multi-modal AI diagnostic engine accelerating rare disease identification using RAG and GNNs."
featuredEligible: true

semester: "Spring 2026"

shortTitle: "DiagRAG"
studentId: ""
videoUrl: ""  # TODO: Add Google Drive link
thumbnail: "" # TODO: Add Google Drive link
githubUrl: "https://github.com/Zesearch/llm-course-26-app-demo/tree/main/projects/07-devshree-hardiksinh-jadeja"
---

## Problem

Rare disease diagnosis is a "diagnostic odyssey" for patients, often taking years and multiple specialist visits. The challenge lies in the fragmentation of data: genomic variants, clinical phenotypes, biological pathways, and scientific literature are often siloed. Clinicians require a unified system that can synthesize these multi-modal evidence streams into transparent and actionable insights, moving beyond isolated symptom checkers to a platform that provides molecular-level answers.

## Solution

**DiagRAG** is a research-grade diagnostic intelligence platform that automates the integration of multi-modal data to accelerate rare disease identification. By combining structural knowledge reasoning with literature-grounded retrieval, DiagRAG provides a peer-reviewed level of diagnostic accuracy with full explainability.

### 🛠 System Architecture

DiagRAG employs a layered, multi-agent architecture designed for high-precision diagnostic synthesis.

```mermaid
graph TD
    %% Input Layer
    subgraph INPUTS ["1. Multi-Modal Data Ingestion"]
        TEXT(["Clinical Narrative (NLP) <br> Unstructured EHR Text"])
        VCF(["Genomic Variants <br> Patient VCF Data"])
    end

    %% Extraction & Processing Layer
    subgraph PROCESSING ["2. Independent Extraction & Reasoning Layers"]
        
        %% NLP + Negative Phenotypes
        TEXT -->|"BioBERT Transformer NER"| HPO_EXT["Standardized HPO Code Mapping"]
        HPO_EXT -->|"Sentiment & Context Analysis"| SPLIT{"Symptom Presence Router"}
        
        SPLIT -->|"Confirmed Present"| POS_HPO["Positive Phenotype Graph <br> + Severity / Timestamp"]
        SPLIT -->|"Explicitly Denied in Text <br> e.g. 'No seizures'"| NEG_HPO["Negative Phenotype Graph <br> (Exclusion Criteria)"]

        %% Reasoning Engines
        POS_HPO -->|"Neighborhood Propagation"| GNN["GNN Reasoner <br> (Graph Convolution)"]
        VCF -->|"Molecular Risk Scoring"| VAR["Variant Predictor <br> (Pathogenicity ML)"]
        POS_HPO -->|"Semantic Similarity"| RAG["RAG Literature Search <br> (FAISS Context Retrieval)"]

    end

    %% Fusion Engine
    subgraph FUSION ["3. DiagRAG: Bayesian Synthesis & Graph Laplacian"]
        
        GNN -->|"P(Structure | Disease)"| BAYES{"Bayesian Fusion Engine"}
        RAG -->|"P(Evidence | Disease)"| BAYES
        VAR -->|"P(Molecular | Disease)"| BAYES
        
        %% Negative Phenotype Penalty
        NEG_HPO -->|"Bayesian Exclusion Penalty"| BAYES

    end

    %% Final Output
    subgraph OUTPUT ["4. Output"]
        BAYES --> DIAG{{"Final Ranked Differential Diagnosis <br> + Explainable Evidence Rationale"}}
    end

    %% Styling
    classDef input fill:#2d3f4e,stroke:#7aa2f7,color:#fff;
    classDef process fill:#3d2f4a,stroke:#bb9af7,color:#fff;
    classDef nlp fill:#3d4a2f,stroke:#26e07f,color:#fff;
    classDef exclude fill:#4f2f35,stroke:#f7768e,color:#fff;
    classDef fusion fill:#16161e,stroke:#ff9e64,color:#fff;
    
    class TEXT,VCF input;
    class GNN,VAR,RAG process;
    class HPO_EXT,SPLIT,POS_HPO nlp;
    class NEG_HPO exclude;
    class BAYES,DIAG fusion;
```

### 🔬 Technical Deep Dive

- **Clinical NLP (BioBERT Extraction)**: The system utilizes a specialized **BioBERT transformer model** fine-tuned on the Human Phenotype Ontology (HPO). It doesn't just extract entities; it analyzes sentiment and context to distinguish between symptoms current patients have vs. those explicitly denied in notes (negative phenotypes).
- **Explainable AI (XAI)**: Generates human-readable rationales linked to specific pathogenic variants and phenotypic matches.
- **Knowledge Graph Intelligence**: Executes reasoning over a heterogeneous network of 10,000+ Genes, 8,000+ Diseases, and 15,000+ Phenotypes.

## User Flow

- **Data Ingestion**: Clinician uploads a patient's VCF file and/or enters free-text clinical notes.
- **Automated Extraction**: BioBERT transforms raw text into a structured "Phenopacket" of HPO terms.
- **Parallel Reasoning**: The GNN evaluates structural network fit while the RAG engine searches for literature evidence.
- **Diagnostic Synthesis**: Bayesian fusion yields a ranked list of differential diagnoses.
- **Interactive Exploration**: Clinicians explore the results via interactive knowledge graphs and direct links to scientific evidence.

## LLM Components

- **Retrieval-Augmented Generation (RAG)**: The pipeline solves the "hallucination" problem by maintaining a FAISS vector index of over 50,000 clinical abstracts. When a diagnosis is suggested, the system retrieves the top 3-5 most relevant scientific papers.
- **Gemini 1.5 Pro**: Primary diagnostic reasoner, handling complex multi-modal synthesis and generating structured, grounded explanations.
- **BioBERT Transformer**: Specialized model for high-precision clinical entity extraction from unstructured EHR text.
- **Graph Neural Network (GNN)**: A custom 2-layer Graph Convolutional Network (GCN) that performs "hidden relationship" discovery to surface candidate genes.
- **Bayesian Evidence Fusion**: Probabilities from the semantic NLP models, GNN structural signals, and PyTorch variant predictors are mathematically fused to output a statistically robust final ranking.

## Tools

- **Frontend:** Next.js 14, Tailwind CSS, Lucide-React, Framer Motion
- **Backend:** FastAPI (Python 3.10), PyTorch, NumPy
- **Vector Database:** FAISS-CPU
- **Inference Engine:** Google Generative AI (Gemini 1.5 Pro API)
