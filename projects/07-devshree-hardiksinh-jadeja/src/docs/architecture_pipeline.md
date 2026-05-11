# DiagRAG — Full Analysis Pipeline Architecture

This document details the end-to-end multi-modal diagnostic pipeline powering the **DiagRAG** platform.

## 1. System Overview

DiagRAG is a multi-modal diagnostic engine combining:
1.  **Clinical Natural Language Processing (BioBERT)**
2.  **Structural Knowledge Reasoning (GNN)**
3.  **Literature-Grounded Retrieval (RAG)**
4.  **Bayesian Evidence Fusion**

These modalities are aggregated by the **DiagRAG Reasoning Core**, which computes a final unified certainty score.

## 2. Layered Architecture

### Layer 1: Data Ingestion (The Input Layer)
User inputs arrive across parallel streams:
*   **Clinical Narrative**: Raw physician notes or patient history.
*   **Genomic Data**: VCF files containing patient variants.

### Layer 2: Entity Extraction (The Entity Mapping Layer)
Inputs are projected into structured representations:
*   **NLP Extraction**: BioBERT transforms raw text into standardized Human Phenotype Ontology (HPO) terms.
*   **Variant Parsing**: Genomic data is parsed into pathogenic candidate lists.

### Layer 3: Reasoning Engines (The Computation Layer)
Extracts signal from entities using specialized models:
*   **GNN Reasoner**: Executes graph convolutions over a heterogeneous network of Genes, Diseases, and Phenotypes.
*   **RAG Engine**: Performs similarity search (FAISS) across medicine's vast research literature to find supporting evidence.

### Layer 4: Multi-Modal Synthesis (The Bayesian Fusion Layer)
The probabilistic results from the reasoning engines are mathematically unified:
*   **Input**: $[P_{gnn}(Network), P_{rag}(Literature), P_{var}(Genetics)]$
*   **Processing**: Distributed probabilities are fused into a single posterior confidence score using Bayesian inference.

### Layer 5: Output & Explainability (The Presentation Layer)
*   **Results Dashboard**: Ranked differential diagnoses with visual evidence fingerprints.
*   **Evidence Provenance**: Direct links to the scientific papers retrieved by the RAG engine.

## 3. Performance & Scalability

*   **Asynchronous Inference**: The GNN and RAG modules operate in parallel, ensuring full analysis in under 5 seconds.
*   **Stateless Scaling**: The backend is designed for horizontal scalability across cloud environments.
*   **Grounding Logic**: Unlike standard LLMs, DiagRAG's RAG-centric approach eliminates "hallucinations" by grounding every diagnosis in verifiable data.
