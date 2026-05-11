"""
DiagRAG API — ML/DL-Powered Rare Disease Diagnostic Engine
===========================================================
Advanced FastAPI backend with 4 production ML/DL models:
1. Clinical NLP Engine (sentence-transformers + TF-IDF)
2. Variant Pathogenicity Predictor (PyTorch MLP)
3. Phenotype Similarity Network (contrastive embeddings)
4. Graph Neural Network Reasoner (2-layer GCN)

Plus: Bayesian inference, knowledge graph, pathway analysis,
drug repurposing, temporal progression, and literature mining.
"""

import sys
import os
import time

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel
import json
import logging
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diagrag")

# Import models
from models import (
    PatientInput, HPOPhenotype, Gene, Disease, Pathway, Variant,
    Evidence, DiagnosisResult, AnalysisResponse,
    NLPExtractionResult, VariantPredictionResult, MLScores,
    WEIGHT_PATHOGENIC, WEIGHT_LIKELY_PATHOGENIC, WEIGHT_VUS, WEIGHT_BENIGN,
    AdvancedAnalysisResponse, PhenotypicFeature
)

# Import enhanced database
from data.enhanced_mock_db import (
    GENE_DB, DISEASE_DB, HPO_DB, GENE_PHENOTYPE_MAP,
    PATHWAY_DB, CLINVAR_MOCK_DB, DRUG_DB, DISEASE_PROGRESSION, LITERATURE_DB
)

# =============================================================================
# LOAD ML MODELS (self-train at startup)
# =============================================================================
print("\n" + "=" * 60)
print("  DiagRAG — Loading ML/DL Models")
print("=" * 60)

startup_start = time.time()

from ml.clinical_nlp import (
    nlp_engine, ClinicalNLPEngine, StatusExtractor, ExclusionExtractor, TemporalTagger,
    ContextClassifier, SeverityCertaintyExtractor, PhenopacketBuilder,
    LabImagingExtractor, InheritanceDetector, MissingnessHandler
)
from ml.ocr_engine import ocr_engine, OCREngine
from ml.variant_predictor import variant_predictor, VariantPredictor
from ml.phenotype_embeddings import phenotype_network, PhenotypeEmbeddingNetwork
from ml.gnn_reasoner import gnn_reasoner, GNNReasoner
from api.differential_engine import differential_engine, info_gain_calculator

startup_time = time.time() - startup_start
print(f"\n[DiagRAG] All ML models loaded in {startup_time:.2f}s")
print("=" * 60 + "\n")

# =============================================================================
# ADVANCED REASONING ENGINE (with ML integration)
# =============================================================================
from collections import defaultdict
import math


class AdvancedReasoningEngine:
    """Multi-modal AI reasoning engine with ML/DL integration"""

    def __init__(self):
        self.disease_priors = self._compute_disease_priors()
        self.phenotype_specificity = self._compute_phenotype_specificity()

    def _compute_disease_priors(self) -> Dict[str, float]:
        priors = {}
        num_diseases = len(DISEASE_DB)
        base_prior = 1.0 / max(num_diseases, 1)
        for disease_id in DISEASE_DB:
            priors[disease_id] = base_prior
        return priors

    def _compute_phenotype_specificity(self) -> Dict[str, float]:
        specificity = {}
        phenotype_gene_count = defaultdict(int)
        for gene, hpo_ids in GENE_PHENOTYPE_MAP.items():
            for hpo_id in hpo_ids:
                phenotype_gene_count[hpo_id] += 1
        max_count = max(phenotype_gene_count.values()) if phenotype_gene_count else 1
        for hpo_id in HPO_DB:
            count = phenotype_gene_count.get(hpo_id, 1)
            specificity[hpo_id] = 1.0 - (count / max_count) * 0.5 + 0.5
        return specificity

    def analyze(self, patient_data: PatientInput) -> Tuple[List[DiagnosisResult], List[Dict]]:
        # Initialize modular components
        exclusion_ext = ExclusionExtractor()
        temporal_ext = TemporalTagger()
        context_ext = ContextClassifier()
        severity_ext = SeverityCertaintyExtractor()
        lab_imaging_ext = LabImagingExtractor()
        inheritance_ext = InheritanceDetector()
        builder = PhenopacketBuilder()

        # Step 1: NLP extraction & Enrichment
        phenopacket = []
        if patient_data.clinical_notes:
            # Dual-strategy extraction
            raw_entities = nlp_engine.extract_hpo_terms(patient_data.clinical_notes)
            
            # Enrich with modular extractors
            entities = exclusion_ext.enrich(raw_entities, patient_data.clinical_notes)
            entities = temporal_ext.enrich(entities, patient_data.clinical_notes)
            entities = context_ext.enrich(entities, patient_data.clinical_notes)
            entities = severity_ext.enrich(entities, patient_data.clinical_notes)
            entities = lab_imaging_ext.enrich(entities, patient_data.clinical_notes)
            entities = inheritance_ext.enrich(entities, patient_data.clinical_notes)
            
            # Build Phenopacket-style structured data
            phenopacket = builder.build(entities)
            
            # Add non-excluded HPO terms to patient data for downstream scoring
            for p in phenopacket:
                if not p["excluded"] and p["hpo_id"] not in patient_data.hpo_ids:
                    patient_data.hpo_ids.append(p["hpo_id"])

        # Use new LLM RAG engine for the actual diagnostic reasoning!
        from reasoning.llm_reasoner import llm_reason_engine
        scored_results = llm_reason_engine.analyze(patient_data)

        # Post-process to backfill matching_phenotypes, variants, and ML scores
        for result in scored_results:
            # 1. Backfill matching phenotypes
            pheno_score, matching_phenotypes = self._score_phenotypes(result.gene.symbol, patient_data.hpo_ids)
            result.matching_phenotypes = matching_phenotypes

            # 2. Backfill predicted variants from VCF
            var_score_ml, variants_found, variant_preds = self._score_variants_ml(result.gene.symbol, patient_data.vcf_content)
            result.variants = variants_found

            # 3. Backfill pathways
            _, pathways = self._score_pathways(result.gene.symbol)
            result.pathways = pathways

            # 4. Backfill ML Scores for UI rendering
            from models import MLScores, VariantPredictionResult
            if not result.ml_scores:
                result.ml_scores = MLScores(
                    nlp_extractions=[],
                    variant_predictions=[],
                    phenotype_similarity={},
                    gnn_scores={},
                    gnn_similar_genes=[],
                )
            
            gnn_score_val = gnn_reasoner.score_gene_disease(result.gene.symbol, result.disease.id)
            result.ml_scores.gnn_scores = {result.disease.id: gnn_score_val}
            result.ml_scores.gnn_similar_genes = gnn_reasoner.get_similar_genes(result.gene.symbol, top_k=5)
            result.ml_scores.variant_predictions = [
                VariantPredictionResult(
                    variant_id=vp.variant_id,
                    pathogenicity_score=vp.pathogenicity_score,
                    classification=vp.classification,
                    confidence=vp.confidence,
                    feature_importances=vp.feature_importances
                )
                for vp in variant_preds
            ]

            # 5. Hybrid True ML Ranking:
            # Combine the base LLM semantic score with deterministic GNN structural score & ML Variants
            # LLM score is 0-100, gnn_score is 0-1, pheno_score is 0-1, var_score_ml is 0-1
            base_llm = result.score
            hybrid_score = (base_llm * 0.4) + (pheno_score * 20) + (gnn_score_val * 20) + (var_score_ml * 20)
            result.score = round(min(max(hybrid_score, 10.0), 99.9), 1)

        # Re-sort results based on the new hybrid true ML score
        scored_results.sort(key=lambda x: x.score, reverse=True)
        # Apply updated rank and confidence strings
        for idx, res in enumerate(scored_results):
            res.rank = idx + 1
            if res.score >= 85:
                res.confidence = "High"
            elif res.score >= 60:
                res.confidence = "Medium"
            else:
                res.confidence = "Low"

        return scored_results, phenopacket

    def _identify_candidate_genes(self, patient_data: PatientInput) -> List[str]:
        candidates = set()
        if patient_data.vcf_content:
            for var_id in CLINVAR_MOCK_DB:
                if var_id in patient_data.vcf_content:
                    for gene_symbol in GENE_DB:
                        if self._variant_matches_gene(var_id, gene_symbol):
                            candidates.add(gene_symbol)
        if patient_data.hpo_ids:
            for gene_symbol, hpo_ids in GENE_PHENOTYPE_MAP.items():
                if any(hpo in patient_data.hpo_ids for hpo in hpo_ids):
                    candidates.add(gene_symbol)
        if not candidates:
            candidates = set(GENE_DB.keys())
        return list(candidates)

    def _variant_matches_gene(self, variant_id: str, gene_symbol: str) -> bool:
        gene_variant_map = {
            "FBN1": ["chr15:g.48712345", "chr15:g.48712346", "chr15:g.48712347"],
            "FGFR3": ["chr4:g.1802345", "chr4:g.1802346"],
            "MECP2": ["chrX:g.154030589", "chrX:g.154030590"],
            "DMD": ["chrX:g.31137344"],
            "CFTR": ["chr7:g.117559590"],
        }
        if gene_symbol in gene_variant_map:
            return any(v in variant_id for v in gene_variant_map[gene_symbol])
        return False


    def _score_phenotypes(self, gene_symbol, patient_hpo_ids):
        gene_hpo_ids = GENE_PHENOTYPE_MAP.get(gene_symbol, [])
        if not gene_hpo_ids:
            return 0.0, []
        matching_phenotypes = []
        weighted_score = 0.0
        for hpo_id in gene_hpo_ids:
            if hpo_id in patient_hpo_ids and hpo_id in HPO_DB:
                matching_phenotypes.append(HPO_DB[hpo_id])
                specificity = self.phenotype_specificity.get(hpo_id, 0.5)
                weighted_score += specificity * 2.0
        coverage_bonus = (len(matching_phenotypes) / len(gene_hpo_ids)) * 3.0
        return weighted_score + coverage_bonus, matching_phenotypes

    def _score_variants_ml(self, gene_symbol, vcf_content):
        """Score variants using the DL pathogenicity predictor"""
        if not vcf_content:
            return 0.0, [], []

        variants_found = []
        variant_preds = []
        variant_score = 0.0

        for var_id, classification in CLINVAR_MOCK_DB.items():
            if var_id in vcf_content and self._variant_matches_gene(var_id, gene_symbol):
                # Use ML predictor
                prediction = variant_predictor.predict(var_id, gene_symbol)
                variant_preds.append(prediction)

                # Use ML score for weighting
                ml_score = prediction.pathogenicity_score
                if ml_score >= 0.85:
                    weight = WEIGHT_PATHOGENIC
                    score_c = 15.0 * ml_score
                elif ml_score >= 0.65:
                    weight = WEIGHT_LIKELY_PATHOGENIC
                    score_c = 10.0 * ml_score
                elif ml_score >= 0.35:
                    weight = WEIGHT_VUS
                    score_c = 2.0 * ml_score
                else:
                    weight = WEIGHT_BENIGN
                    score_c = -5.0
                
                variant_score += score_c
                variants_found.append(Variant(
                    id=var_id, gene_symbol=gene_symbol,
                    clinvar_classification=prediction.classification,
                    weight=weight
                ))

        return max(variant_score, 0.0), variants_found, variant_preds

    def _score_pathways(self, gene_symbol):
        pathway_strs = PATHWAY_DB.get(gene_symbol, [])
        pathways = []
        for p_str in pathway_strs:
            parts = p_str.split(": ", 1)
            if len(parts) == 2:
                pathways.append(Pathway(id=parts[0], name=parts[1]))
        return min(len(pathways) * 1.0, 5.0), pathways

    def _score_temporal_coherence(self, disease_id):
        return 2.0 if disease_id in DISEASE_PROGRESSION else 0.0

    def _score_literature(self, gene_symbol):
        if gene_symbol in LITERATURE_DB:
            citations = LITERATURE_DB[gene_symbol]
            score = sum(c.get("relevance", 0.5) for c in citations) * 1.5
            return min(score, 5.0)
        return 0.0

    def _apply_bayesian_inference(self, results):
        for result in results:
            prior = self.disease_priors.get(result.disease.id, 0.001)
            likelihood = 1.0 / (1.0 + math.exp(-result.score / 10.0))
            posterior = likelihood * prior * 100
            result.score = round(result.score * 0.7 + posterior * 0.3, 2)
        return results

    def _determine_confidence(self, score, num_variants, num_phenotypes):
        if score > 20 and num_variants > 0:
            return "High"
        elif score > 15 or (score > 10 and num_phenotypes >= 3):
            return "Medium"
        return "Low"

    def _generate_explanation(self, gene, disease, phenotypes, variants, pathways):
        parts = []
        if variants:
            pathogenic = [v for v in variants if "Pathogenic" in v.clinvar_classification]
            if pathogenic:
                parts.append(f"Pathogenic variant(s) in {gene.symbol} strongly support {disease.name}")
        if phenotypes:
            if len(phenotypes) >= 4:
                parts.append(f"Extensive phenotype overlap ({len(phenotypes)} matching features)")
            elif len(phenotypes) >= 2:
                parts.append(f"Moderate phenotype match with key features: {', '.join([p.label for p in phenotypes[:3]])}")
            elif len(phenotypes) == 1:
                parts.append(f"Single phenotype match: {phenotypes[0].label}")
        if pathways:
            parts.append(f"Biological pathway involvement supports mechanism")
        if not parts:
            return f"{gene.symbol} is associated with {disease.name}, but evidence is limited."
        return ". ".join(parts) + "."

    def _get_disease_for_gene(self, gene_symbol):
        for disease in DISEASE_DB.values():
            if gene_symbol in disease.associated_genes:
                return disease
        return None


# Initialize engine
engine = AdvancedReasoningEngine()

# =============================================================================
# Extended Response Models
# =============================================================================

class KnowledgeGraphNode(BaseModel):
    id: str
    label: str
    type: str
    metadata: Dict[str, Any] = {}

class KnowledgeGraphEdge(BaseModel):
    source: str
    target: str
    relationship: str
    weight: float = 1.0

class KnowledgeGraphResponse(BaseModel):
    nodes: List[KnowledgeGraphNode]
    edges: List[KnowledgeGraphEdge]

class DrugRecommendation(BaseModel):
    name: str
    type: str
    mechanism: str
    status: str
    evidence: str

class TimelineStage(BaseModel):
    age: str
    symptoms: List[str]

class DiseaseTimelineResponse(BaseModel):
    disease_name: str
    onset_age: str
    life_expectancy: str
    progression: List[TimelineStage]

class LiteratureCitation(BaseModel):
    pmid: str
    title: str
    journal: str
    year: int
    relevance: float

# Redundant model removed, using models.py version

# =============================================================================
# FASTAPI APP
# =============================================================================
app = FastAPI(
    title="DiagRAG API",
    description="ML/DL-Powered Rare Disease Diagnostic Engine",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.feedback_loop import router as feedback_router
app.include_router(feedback_router, prefix="/api")


@app.get("/")
def health_check():
    return {
        "status": "active",
        "system": "DiagRAG ML/DL Engine v3.0",
        "ml_models": [
            "Clinical NLP (BioBERT)",
            "Variant Pathogenicity (PyTorch MLP)",
            "Phenotype Similarity (Contrastive Embeddings)",
            "GNN Reasoner (Graph Convolutional Network)"
        ],
        "diseases_covered": len(DISEASE_DB),
        "genes_indexed": len(GENE_DB),
        "phenotypes_available": len(HPO_DB),
    }


# --- Core Analysis Endpoint ---
@app.post("/analyze", response_model=AdvancedAnalysisResponse)
async def analyze_patient(
    vcf: Optional[UploadFile] = File(None),
    notes: Optional[str] = Form(None),
    hpo_ids: Optional[str] = Form(None),
):
    try:
        vcf_content = None
        if vcf:
            content = await vcf.read()
            vcf_content = content.decode("utf-8")

        parsed_hpo_ids = []
        if hpo_ids:
            try:
                parsed_hpo_ids = json.loads(hpo_ids)
            except Exception:
                pass

        # NLP extraction happens inside engine.analyze() now
        patient_input = PatientInput(
            vcf_content=vcf_content,
            clinical_notes=notes,
            hpo_ids=parsed_hpo_ids,
        )

        start_time = time.time()
        results, phenopacket = engine.analyze(patient_input)

        processing_time = (time.time() - start_time) * 1000

        return AdvancedAnalysisResponse(
            results=results,
            phenopacket=[PhenotypicFeature(**p) for p in phenopacket],
            processing_time_ms=processing_time,
            analysis_metadata={
                "engine_version": "3.0",
                "reasoning_method": "ML/DL-Enhanced Bayesian Multi-Modal Inference",
                "candidate_genes_evaluated": len(engine._identify_candidate_genes(patient_input)),
                "hpo_terms_used": len(patient_input.hpo_ids),
                "ml_models_active": [
                    nlp_engine.get_model_info()["model_type"],
                    variant_predictor.get_model_info()["model_type"],
                    phenotype_network.get_model_info()["model_type"],
                    gnn_reasoner.get_model_info()["model_type"],
                ],
                "evidence_sources": [
                    "Clinical NLP (BioBERT/TF-IDF)",
                    "DL Variant Pathogenicity Predictor",
                    "Neural Phenotype Similarity",
                    "GNN Knowledge Graph Reasoning",
                    "Reactome Pathway Database",
                    "PubMed Literature",
                    "Temporal Disease Models",
                ],
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Phenotype Search ---
@app.get("/phenotypes/search")
def search_phenotypes(q: str):
    matches = []
    q_lower = q.lower()
    for hpo_id, phenotype in HPO_DB.items():
        if q_lower in phenotype.label.lower():
            matches.append(phenotype)
    return matches


# --- ML Models Status ---
@app.get("/ml/status")
def get_ml_status():
    """Get status and metadata for all ML models"""
    return {
        "models": [
            nlp_engine.get_model_info(),
            variant_predictor.get_model_info(),
            phenotype_network.get_model_info(),
            gnn_reasoner.get_model_info(),
        ],
        "startup_time_seconds": round(startup_time, 2),
        "total_models": 4,
    }


# --- ML Explain ---
@app.get("/ml/explain/{gene_symbol}")
def explain_gene(gene_symbol: str):
    """Get ML model explanations for a specific gene"""
    gene_symbol = gene_symbol.upper()
    
    if gene_symbol not in GENE_DB:
        raise HTTPException(status_code=404, detail=f"Gene {gene_symbol} not found")
    
    # GNN similar genes
    similar_genes = gnn_reasoner.get_similar_genes(gene_symbol, top_k=5)
    
    # GNN scores for each disease
    gnn_disease_scores = {}
    for disease_id, disease in DISEASE_DB.items():
        score = gnn_reasoner.score_gene_disease(gene_symbol, disease_id)
        if score > 0.05:
            gnn_disease_scores[disease_id] = {
                "disease_name": disease.name,
                "gnn_score": score
            }
    
    # Phenotype embeddings
    hpo_ids = GENE_PHENOTYPE_MAP.get(gene_symbol, [])
    phenotype_embeddings = {}
    for hpo_id in hpo_ids:
        emb = phenotype_network.get_embedding(hpo_id)
        if emb:
            phenotype_embeddings[hpo_id] = {
                "label": HPO_DB[hpo_id].label if hpo_id in HPO_DB else hpo_id,
                "embedding_norm": round(float(sum(x**2 for x in emb)**0.5), 4),
                "ic_score": round(phenotype_network.ic_scores.get(hpo_id, 0), 4)
            }
    
    # Variant predictions for known variants
    variant_preds = []
    for var_id in CLINVAR_MOCK_DB:
        if engine._variant_matches_gene(var_id, gene_symbol):
            pred = variant_predictor.predict(var_id, gene_symbol)
            variant_preds.append({
                "variant_id": pred.variant_id,
                "pathogenicity_score": pred.pathogenicity_score,
                "classification": pred.classification,
                "confidence": pred.confidence,
                "top_features": dict(sorted(
                    pred.feature_importances.items(),
                    key=lambda x: x[1], reverse=True
                )[:5])
            })
    
    return {
        "gene": gene_symbol,
        "gnn_analysis": {
            "similar_genes": similar_genes,
            "disease_associations": gnn_disease_scores,
        },
        "phenotype_analysis": {
            "hpo_terms": phenotype_embeddings,
            "total_phenotypes": len(hpo_ids),
        },
        "variant_analysis": {
            "predictions": variant_preds,
            "total_variants": len(variant_preds),
        },
    }


# --- Knowledge Graph API ---
@app.get("/knowledge-graph/{gene_symbol}", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(gene_symbol: str):
    """Get the knowledge graph centered on a gene"""
    nodes = []
    edges = []
    seen_ids = set()

    gene_symbol = gene_symbol.upper()

    if gene_symbol not in GENE_DB:
        raise HTTPException(status_code=404, detail=f"Gene {gene_symbol} not found")

    gene = GENE_DB[gene_symbol]

    # Gene node
    gene_node_id = f"gene_{gene_symbol}"
    nodes.append(KnowledgeGraphNode(
        id=gene_node_id, label=gene_symbol, type="gene",
        metadata={"name": gene.name, "chromosome": gene.chromosome or "", "description": gene.description or ""}
    ))
    seen_ids.add(gene_node_id)

    # Disease nodes
    for disease in DISEASE_DB.values():
        if gene_symbol in disease.associated_genes:
            disease_node_id = f"disease_{disease.id}"
            if disease_node_id not in seen_ids:
                nodes.append(KnowledgeGraphNode(
                    id=disease_node_id, label=disease.name, type="disease",
                    metadata={"omim_id": disease.id}
                ))
                seen_ids.add(disease_node_id)
            edges.append(KnowledgeGraphEdge(source=gene_node_id, target=disease_node_id, relationship="causes", weight=1.0))

            # Drug nodes
            if disease.id in DRUG_DB:
                for drug in DRUG_DB[disease.id]:
                    drug_node_id = f"drug_{drug['name'].replace(' ', '_')}"
                    if drug_node_id not in seen_ids:
                        nodes.append(KnowledgeGraphNode(
                            id=drug_node_id, label=drug["name"], type="drug",
                            metadata={"type": drug["type"], "status": drug["status"], "mechanism": drug["mechanism"]}
                        ))
                        seen_ids.add(drug_node_id)
                    edges.append(KnowledgeGraphEdge(source=drug_node_id, target=disease_node_id, relationship="treats", weight=0.8))

    # Phenotype nodes
    hpo_ids = GENE_PHENOTYPE_MAP.get(gene_symbol, [])
    for hpo_id in hpo_ids:
        if hpo_id in HPO_DB:
            phenotype = HPO_DB[hpo_id]
            pheno_node_id = f"phenotype_{hpo_id}"
            if pheno_node_id not in seen_ids:
                nodes.append(KnowledgeGraphNode(
                    id=pheno_node_id, label=phenotype.label, type="phenotype",
                    metadata={"hpo_id": hpo_id, "description": phenotype.description or ""}
                ))
                seen_ids.add(pheno_node_id)
            edges.append(KnowledgeGraphEdge(source=gene_node_id, target=pheno_node_id, relationship="associated_with", weight=0.9))

    # Pathway nodes
    pathway_strs = PATHWAY_DB.get(gene_symbol, [])
    for p_str in pathway_strs:
        parts = p_str.split(": ", 1)
        if len(parts) == 2:
            pathway_node_id = f"pathway_{parts[0]}"
            if pathway_node_id not in seen_ids:
                nodes.append(KnowledgeGraphNode(
                    id=pathway_node_id, label=parts[1], type="pathway",
                    metadata={"reactome_id": parts[0]}
                ))
                seen_ids.add(pathway_node_id)
            edges.append(KnowledgeGraphEdge(source=gene_node_id, target=pathway_node_id, relationship="participates_in", weight=0.7))

    # Cross-gene connections
    for other_gene, other_hpo_ids in GENE_PHENOTYPE_MAP.items():
        if other_gene != gene_symbol:
            shared = set(hpo_ids) & set(other_hpo_ids)
            if len(shared) >= 2:
                other_gene_id = f"gene_{other_gene}"
                if other_gene_id not in seen_ids:
                    other_gene_data = GENE_DB.get(other_gene)
                    if other_gene_data:
                        nodes.append(KnowledgeGraphNode(
                            id=other_gene_id, label=other_gene, type="gene",
                            metadata={"name": other_gene_data.name}
                        ))
                        seen_ids.add(other_gene_id)
                        edges.append(KnowledgeGraphEdge(
                            source=gene_node_id, target=other_gene_id,
                            relationship="shares_phenotypes", weight=len(shared) / max(len(hpo_ids), 1)
                        ))

    return KnowledgeGraphResponse(nodes=nodes, edges=edges)


# --- Pathway API ---
@app.get("/pathways/{gene_symbol}")
def get_pathways(gene_symbol: str):
    gene_symbol = gene_symbol.upper()
    pathway_strs = PATHWAY_DB.get(gene_symbol, [])
    pathways = []
    for p_str in pathway_strs:
        parts = p_str.split(": ", 1)
        if len(parts) == 2:
            shared_genes = []
            for other_gene, other_pathways in PATHWAY_DB.items():
                if other_gene != gene_symbol:
                    for op in other_pathways:
                        if parts[0] in op:
                            shared_genes.append(other_gene)
                            break
            pathways.append({
                "id": parts[0],
                "name": parts[1],
                "gene": gene_symbol,
                "shared_genes": shared_genes,
                "significance": "High" if len(shared_genes) > 0 else "Normal",
            })
    return {"gene": gene_symbol, "pathways": pathways}


# --- Drug Repurposing API ---
@app.get("/drugs/recommendations/{disease_id}")
def get_drug_recommendations(disease_id: str):
    if disease_id not in DRUG_DB:
        for did, disease in DISEASE_DB.items():
            if disease_id.lower() in disease.name.lower():
                disease_id = did
                break
    drugs = DRUG_DB.get(disease_id, [])
    disease = DISEASE_DB.get(disease_id)
    return {
        "disease_id": disease_id,
        "disease_name": disease.name if disease else "Unknown",
        "recommendations": drugs,
        "total_recommendations": len(drugs),
    }


# --- Temporal Disease Progression ---
@app.get("/timeline/{disease_id}", response_model=DiseaseTimelineResponse)
def get_disease_timeline(disease_id: str):
    if disease_id not in DISEASE_PROGRESSION:
        for did in DISEASE_PROGRESSION:
            if disease_id in did:
                disease_id = did
                break
    if disease_id not in DISEASE_PROGRESSION:
        raise HTTPException(status_code=404, detail="No temporal data available for this disease")

    progression_data = DISEASE_PROGRESSION[disease_id]
    disease = DISEASE_DB.get(disease_id)

    return DiseaseTimelineResponse(
        disease_name=disease.name if disease else disease_id,
        onset_age=progression_data["onset_age"],
        life_expectancy=progression_data.get("life_expectancy", "Unknown"),
        progression=[
            TimelineStage(age=stage["age"], symptoms=stage["symptoms"])
            for stage in progression_data["progression"]
        ],
    )


# --- Literature API ---
@app.get("/literature/{gene_symbol}")
def get_literature(gene_symbol: str):
    gene_symbol = gene_symbol.upper()
    citations = LITERATURE_DB.get(gene_symbol, [])
    return {
        "gene": gene_symbol,
        "citations": citations,
        "total": len(citations),
    }


# --- Full knowledge graph ---
@app.get("/knowledge-graph-full")
def get_full_knowledge_graph():
    nodes = []
    edges = []
    seen = set()

    for gene_symbol in list(GENE_PHENOTYPE_MAP.keys())[:15]:
        if gene_symbol in GENE_DB:
            gene = GENE_DB[gene_symbol]
            gene_id = f"gene_{gene_symbol}"
            if gene_id not in seen:
                nodes.append({"id": gene_id, "label": gene_symbol, "type": "gene"})
                seen.add(gene_id)

            for disease in DISEASE_DB.values():
                if gene_symbol in disease.associated_genes:
                    did = f"disease_{disease.id}"
                    if did not in seen:
                        nodes.append({"id": did, "label": disease.name, "type": "disease"})
                        seen.add(did)
                    edges.append({"source": gene_id, "target": did, "relationship": "causes"})

    return {"nodes": nodes, "edges": edges}


# --- Stats endpoint ---
@app.get("/stats")
def get_stats():
    return {
        "total_diseases": len(DISEASE_DB),
        "total_genes": len(GENE_DB),
        "total_phenotypes": len(HPO_DB),
        "total_pathways": sum(len(v) for v in PATHWAY_DB.values()),
        "total_drugs": sum(len(v) for v in DRUG_DB.values()),
        "diseases_with_progression": len(DISEASE_PROGRESSION),
        "genes_with_literature": len(LITERATURE_DB),
        "ml_models_active": 6,
    }


# =============================================================================
# PIPELINE ENDPOINTS — Ingestion & Core Processing
# =============================================================================

class PipelineExtractRequest(BaseModel):
    text: str
    include_family_history: bool = True

class PipelineFullRequest(BaseModel):
    text: str
    prior_test: Optional[Dict[str, Any]] = None
    hpo_ids: List[str] = []

class DifferentialRequest(BaseModel):
    observed_hpo: List[str]
    excluded_hpo: List[str] = []


@app.post("/pipeline/extract")
def pipeline_extract(req: PipelineExtractRequest):
    """
    Module 1: Standalone Phenotype Extraction.
    Runs the full 4-component NLP pipeline:
      A) StatusExtractor   — present / absent / uncertain
      B) TemporalTagger    — onset / resolution / ongoing
      C) ContextClassifier — patient vs. family member + family_relation
      D) SeverityCertaintyExtractor — severity + confidence score
    Plus MissingnessHandler (equity guard) and full PhenopacketBuilder schema.
    """
    # Component pipeline (4-component per Hakon's spec)
    status_ext     = StatusExtractor()
    temporal_ext   = TemporalTagger()
    context_ext    = ContextClassifier()
    severity_ext   = SeverityCertaintyExtractor()
    lab_imaging_ext = LabImagingExtractor()
    inheritance_ext = InheritanceDetector()
    missingness_handler = MissingnessHandler()
    builder        = PhenopacketBuilder()

    raw_entities = nlp_engine.extract_hpo_terms(req.text)
    entities = status_ext.enrich(raw_entities, req.text)        # Component A
    entities = temporal_ext.enrich(entities, req.text)          # Component B
    entities = context_ext.enrich(entities, req.text)           # Component C
    entities = severity_ext.enrich(entities, req.text)          # Component D
    entities = lab_imaging_ext.enrich(entities, req.text)
    entities = inheritance_ext.enrich(entities, req.text)

    # Equity guard: handle sparse/incomplete records
    entities, missingness_report = missingness_handler.handle(entities, req.text)

    phenopacket = builder.build(entities)

    # Separate by status
    present   = [p for p in phenopacket if p["status"] == "present"]
    absent    = [p for p in phenopacket if p["status"] == "absent"]
    uncertain = [p for p in phenopacket if p["status"] == "uncertain"]

    # Get suspected inheritance from entities
    suspected_inheritance = "unknown"
    for p in phenopacket:
        if p.get("suspected_inheritance") and p["suspected_inheritance"] != "unknown":
            suspected_inheritance = p["suspected_inheritance"]
            break

    return {
        "phenopacket": phenopacket,
        "present_count": len(present),
        "absent_count": len(absent),
        "uncertain_count": len(uncertain),
        "excluded_count": len(absent),  # backward-compat
        "suspected_inheritance": suspected_inheritance,
        "hpo_ids_present": [p["hpo_id"] for p in present],
        "hpo_ids_absent": [p["hpo_id"] for p in absent],
        "hpo_ids_uncertain": [p["hpo_id"] for p in uncertain],
        "hpo_ids_excluded": [p["hpo_id"] for p in absent],  # backward-compat
        "extraction_confidence": (
            round(sum(p["link_confidence"] for p in phenopacket) / len(phenopacket), 3)
            if phenopacket else 0.0
        ),
        "missingness_report": missingness_report,
    }

@app.post("/pipeline/ocr")
async def pipeline_ocr(file: UploadFile = File(...)):
    """
    Module 1: Clinical PDF / Image Scraper.
    Accepts a PDF/Image file, runs OCR/extraction, and returns raw text.
    """
    # Create temp file to save the uploaded content
    import tempfile
    
    # Check extension
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Run OCR
        extracted_text = ocr_engine.extract_text(tmp_path)
    except Exception as e:
        logger.error(f"Pipeline OCR error: {e}")
        return {"error": str(e), "text": ""}
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {
        "filename": filename,
        "text": extracted_text,
        "length": len(extracted_text)
    }


