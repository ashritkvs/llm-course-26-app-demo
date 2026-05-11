from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# --- Enums & Literals ---
# Pathogenicity weights
WEIGHT_PATHOGENIC = 1.0
WEIGHT_LIKELY_PATHOGENIC = 0.8
WEIGHT_VUS = 0.4
WEIGHT_BENIGN = 0.1

class HPOPhenotype(BaseModel):
    id: str
    label: str
    description: Optional[str] = None

class PatientInput(BaseModel):
    vcf_content: Optional[str] = None # Base64 or raw string of VCF
    clinical_notes: Optional[str] = None
    hpo_ids: List[str] = []

class Variant(BaseModel):
    id: str # e.g. "chr4:g.55593655C>T"
    gene_symbol: str
    clinvar_classification: str # "Pathogenic", "Likely pathogenic", "VUS", "Benign"
    weight: float

class Gene(BaseModel):
    symbol: str
    name: str
    description: Optional[str] = None
    chromosome: Optional[str] = None

class Pathway(BaseModel):
    id: str
    name: str

class Disease(BaseModel):
    id: str # e.g. OMIM:154700
    name: str
    description: Optional[str] = None
    associated_genes: List[str] = [] # List of gene symbols

class Evidence(BaseModel):
    source: str # "ClinVar", "OMIM", "HPO", "Reactome"
    description: str
    score_contribution: float

# --- ML-specific response models ---
class NLPExtractionResult(BaseModel):
    hpo_id: str
    label: str
    confidence: float
    source_text: str
    method: str
    negated: bool = False

class VariantPredictionResult(BaseModel):
    variant_id: str
    pathogenicity_score: float
    classification: str
    confidence: float
    feature_importances: Dict[str, float] = {}

class MLScores(BaseModel):
    nlp_extractions: List[NLPExtractionResult] = []
    variant_predictions: List[VariantPredictionResult] = []
    phenotype_similarity: Dict[str, float] = {}  # disease_id → similarity
    gnn_scores: Dict[str, float] = {}  # disease_id → GNN link prediction score
    gnn_similar_genes: List[Dict[str, Any]] = []

class DiagnosisResult(BaseModel):
    rank: int
    gene: Gene
    disease: Disease
    score: float
    confidence: str # "High", "Medium", "Low"
    matching_phenotypes: List[HPOPhenotype]
    variants: List[Variant]
    pathways: List[Pathway]
    evidence: List[Evidence]
    explanation: str
    ml_scores: Optional[MLScores] = None

class AnalysisResponse(BaseModel):
    results: List[DiagnosisResult]
    suggested_next_steps: List[str]

# --- Advanced Response Models (Simplified) ---

class PhenotypicFeature(BaseModel):
    hpo_id: str
    hpo_label: str
    link_confidence: float
    excluded: bool = False
    subject: str = "patient"
    status: str = "unknown"
    onset_age_years: Optional[float] = None
    severity: Optional[str] = None
    certainty: str = "confirmed"
    data_origin: str = "clinical_exam"
    suspected_inheritance: str = "unknown"
    evidence_span: Dict[str, Any] = {}

class AdvancedAnalysisResponse(BaseModel):
    results: List[DiagnosisResult]
    phenopacket: List[PhenotypicFeature]
    processing_time_ms: float
    analysis_metadata: Dict[str, Any] = {}
