import os
import json
import faiss
import numpy as np
from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer

# Try logging
import logging
logger = logging.getLogger(__name__)

from data.enhanced_mock_db import (
    HPO_DB, DISEASE_DB, GENE_DB, PATHWAY_DB, 
    DRUG_DB, LITERATURE_DB, DISEASE_PROGRESSION
)

class RAGIndexer:
    """
    Vector database indexer for DiagRAG.
    Indexes HPO terms, diseases, pathways, drugs, and literature into a unified FAISS index
    for semantic retrieval during RAG.
    """
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model_name = model_name
        self.model = None
        self.index = None
        self.documents = []  # Store metadata for each vector
        self.dimension = 384 # Default for all-MiniLM-L6-v2

    def _get_model(self):
        if self.model is None:
            self.model = SentenceTransformer(self.model_name)
        return self.model

    def build_index(self):
        """Builds the comprehensive FAISS index from the mock database"""
        logger.info("Building RAG Vector Index...")
        sentences = []
        
        # 1. Index HPO Terms
        for hpo_id, hpo_obj in HPO_DB.items():
            text = f"Phenotype: {hpo_obj.label}. "
            if getattr(hpo_obj, 'description', None):
                text += hpo_obj.description
            sentences.append(text)
            self.documents.append({
                "type": "hpo",
                "id": hpo_id,
                "label": hpo_obj.label,
                "content": text
            })

        # 2. Index Diseases (OMIM)
        for disease_id, disease_obj in DISEASE_DB.items():
            # Basic info
            text = f"Disease: {disease_obj.name} (OMIM: {disease_obj.id}). Associated genes: {', '.join(disease_obj.associated_genes)}."
            sentences.append(text)
            self.documents.append({
                "type": "disease",
                "id": disease_id,
                "label": disease_obj.name,
                "content": text
            })
            
            # Temporal progression (indexed separately for fine-grained retrieval)
            if disease_id in DISEASE_PROGRESSION:
                prog = DISEASE_PROGRESSION[disease_id]
                prog_text = f"Progression for {disease_obj.name}: Onset at {prog['onset_age']}. "
                for stage in prog['progression']:
                    prog_text += f"At age {stage['age']}, symptoms include {', '.join(stage['symptoms'])}. "
                sentences.append(prog_text)
                self.documents.append({
                    "type": "disease_progression",
                    "id": disease_id,
                    "label": f"{disease_obj.name} Progression",
                    "content": prog_text
                })

        # 3. Index Drugs & CPIC Guidelines
        for disease_id, drugs in DRUG_DB.items():
            disease_name = DISEASE_DB[disease_id].name if disease_id in DISEASE_DB else disease_id
            for drug in drugs:
                text = f"Treatment for {disease_name}: {drug['name']} ({drug['type']}). Mechanism: {drug['mechanism']}. Evidence: {drug['evidence']}."
                sentences.append(text)
                self.documents.append({
                    "type": "drug",
                    "id": drug['name'],
                    "label": drug['name'],
                    "content": text
                })

        # 4. Index Literature (PubMed)
        for gene_sym, citations in LITERATURE_DB.items():
            for cit in citations:
                text = f"PubMed Abstract (PMID: {cit['pmid']}): {cit['title']} published in {cit['journal']} ({cit['year']}). Relates to gene {gene_sym}."
                sentences.append(text)
                self.documents.append({
                    "type": "literature",
                    "id": cit['pmid'],
                    "label": cit['title'],
                    "content": text
                })

        # 5. Index Genes and Pathways
        for gene_sym, gene_obj in GENE_DB.items():
            text = f"Gene {gene_obj.symbol}: {gene_obj.name}. {getattr(gene_obj, 'description', '')}"
            sentences.append(text)
            self.documents.append({
                "type": "gene",
                "id": gene_sym,
                "label": gene_obj.symbol,
                "content": text
            })
            
            if gene_sym in PATHWAY_DB:
                for path in PATHWAY_DB[gene_sym]:
                    path_text = f"Pathway for {gene_sym}: {path}"
                    sentences.append(path_text)
                    self.documents.append({
                        "type": "pathway",
                        "id": path.split(":")[0] if ":" in path else path,
                        "label": path,
                        "content": path_text
                    })

        # Generate Embeddings
        model = self._get_model()
        logger.info(f"Generating embeddings for {len(sentences)} documents...")
        embeddings = model.encode(sentences, convert_to_numpy=True)
        
        # Build FAISS index for large-scale operations (IVFPQ)
        self.dimension = embeddings.shape[1]
        n_samples = embeddings.shape[0]
        
        if n_samples < 1000:
            # For small datasets, use a flat index (no training required, no segfaults)
            logger.info(f"Using IndexFlatL2 for small dataset ({n_samples} samples)...")
            self.index = faiss.IndexFlatL2(self.dimension)
        else:
            # Calculate dynamic clusters based on sample size (min 5, max 100)
            nlist = max(5, min(100, int(n_samples / 5)))
            m = 8 # Sub-vector size for Product Quantization
            
            quantizer = faiss.IndexFlatL2(self.dimension)
            # Using 8 bits per sub-vector for quantization
            self.index = faiss.IndexIVFPQ(quantizer, self.dimension, nlist, m, 8)
            
            logger.info(f"Training FAISS IVFPQ index with {nlist} clusters...")
            self.index.train(embeddings)
            
        self.index.add(embeddings)
        logger.info("FAISS index built successfully.")

    def search(self, query: str, top_k: int = 5, filter_type: str = None) -> List[Dict[str, Any]]:
        """
        Search the vector index for semantically similar documents.
        """
        if not self.index:
            self.build_index()

        model = self._get_model()
        query_vector = model.encode([query], convert_to_numpy=True)
        
        # Retrieve more if filtering is applied
        search_k = top_k * 3 if filter_type else top_k
        distances, indices = self.index.search(query_vector, search_k)
        
        results = []
        for i, idx in enumerate(indices[0]):
            if idx == -1:
                continue
            doc = self.documents[idx]
            
            if filter_type and doc["type"] != filter_type:
                continue
                
            result = dict(doc)
            result["score"] = float(1.0 / (1.0 + distances[0][i])) # Convert L2 to similarity score format
            results.append(result)
            
            if len(results) >= top_k:
                break
                
        return results

# Singleton instance
rag_indexer = RAGIndexer()
