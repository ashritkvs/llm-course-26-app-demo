# DiagRAG Intelligence – 3 Core Architectural Flowcharts

This document provides focused, highly detailed architectural flowcharts for the three core pillars of the DiagRAG platform. Each chart delineates the Input, Processing Layers, and Output for the production-ready diagnostic pipeline.

---

## 1. GNN Knowledge Graph Reasoner
**Function:** Executes structural reasoning over heterogeneous biological networks to detect gene-disease associations via graph convolution and spectral diffusion.

```mermaid
graph TD
    %% GNN Inputs
    subgraph INPUTS ["Input Layer"]
        HPO(["Parsed HPO Phenotype Identifiers <br> from BioBERT NLP Extraction"])
        NET(["Heterogeneous Knowledge Graph <br> (Genes, Diseases, Phenotypes, Pathways)"])
    end

    %% GNN Layers
    subgraph LAYERS ["Graph Neural Network Layers"]
        HPO -->|"Neighborhood Initialization"| LAT["Latent Representation Ingestion"]
        NET -->|"Structural Weighting"| LAT
        
        LAT --> CONV1["GCN Layer 1 <br> Propagation of Phenotypic Signals"]
        CONV1 --> ATT["Attention-Weighted Aggregation <br> Multi-node Feature Fusion"]
        ATT --> CONV2["GCN Layer 2 <br> Multi-hop Disease Path Traversal"]
        
        CONV2 --> SPEC["Spectral Graph Diffusion <br> L = I - D^-1/2 A D^-1/2"]
    end

    %% GNN Outputs
    subgraph OUTPUTS ["Output Layer"]
        SPEC -->|"Euclidean Proximity"| RANKED{{"Candidate Gene/Disease Clusters <br> Network Association Scores"}}
    end

    classDef in fill:#2d3f4e,stroke:#7aa2f7,color:#fff;
    classDef lay fill:#3d2f4a,stroke:#bb9af7,color:#fff;
    classDef out fill:#4f2f35,stroke:#f7768e,color:#fff;

    class HPO,NET in;
    class LAT,CONV1,ATT,CONV2,SPEC lay;
    class RANKED out;
```

---

## 2. RAG Literature Grounding Engine
**Function:** Binds diagnostic hypotheses to verifiable scientific evidence using high-dimensional vector similarity across clinical databases.

```mermaid
graph TD
    %% RAG Inputs
    subgraph INPUTS ["Input Layer"]
        QUERY(["Patient Narrative & <br> HPO Knowledge Context"])
        VEC_DB[("FAISS Vector Database <br> (Millions of Clinical Abstracts)")]
    end

    %% RAG Layers
    subgraph LAYERS ["Retrieval & Synthesis Layers"]
        QUERY -->|"Neural Embedding"| EMB["Query Vector Projection <br> R^768 Space"]
        
        EMB --> SIM{"FAISS Similarity Engine <br> Top-K Inner Product Search"}
        VEC_DB --> SIM
        
        SIM --> CTX["Retrieved Context Assembly <br> Relevant Research Snippets"]
        
        CTX --> LLM["LLM Synthesis Layer <br> Evidence Grounding & Citation Mapping"]
    end

    %% RAG Outputs
    subgraph OUTPUTS ["Output Layer"]
        LLM --> EV{{"Literature Support Index <br> Provenance-Backed Rationale"}}
    end

    classDef in fill:#2d3f4e,stroke:#7aa2f7,color:#fff;
    classDef lay fill:#3d2f4a,stroke:#bb9af7,color:#fff;
    classDef out fill:#4f2f35,stroke:#f7768e,color:#fff;

    class QUERY,VEC_DB in;
    class EMB,SIM,CTX,LLM lay;
    class EV out;
```

---

## 3. Bayesian Evidence Fusion Engine
**Function:** Merges independent modality distributions into a unified, mathematically rigorous diagnostic ranking.

```mermaid
graph TD
    %% Bayesian Inputs
    subgraph INPUTS ["Independent Evidence Streams"]
        S1(["GNN Network Scores <br> P(Structure | Disease)"])
        S2(["RAG Literature Support <br> P(Evidence | Disease)"])
        S3(["Variant Risk Probability <br> P(Molecular | Disease)"])
    end

    %% Bayesian Layers
    subgraph LAYERS ["Probabilistic Fusion Layers"]
        S1 -->|"Normalization"| DIST["Joint Probability Ingestion"]
        S2 -->|"Normalization"| DIST
        S3 -->|"Normalization"| DIST
        
        DIST --> UPD["Bayesian Posterior Update <br> P(D|E1, E2, E3)"]
        
        UPD --> CALIB["Global Calibration Layer <br> Confidence Recalibration"]
    end

    %% Bayesian Outputs
    subgraph OUTPUTS ["Diagnostic Result"]
        CALIB --> FINAL{{"Unified Diagnostic Ranking <br> with Multimodal Confidence"}}
    end

    classDef in fill:#2d3f4e,stroke:#7aa2f7,color:#fff;
    classDef lay fill:#3d2f4a,stroke:#bb9af7,color:#fff;
    classDef out fill:#4f2f35,stroke:#f7768e,color:#fff;

    class S1,S2,S3 in;
    class DIST,UPD,CALIB lay;
    class FINAL out;
```
