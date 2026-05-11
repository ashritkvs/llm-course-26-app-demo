from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class FeedbackData(BaseModel):
    record_id: str
    entity_id: str
    entity_type: str # 'disease', 'phenotype', 'drug'
    correction: str # user provided correct context or "REDACT"
    comments: Optional[str] = None

# We store this in a local file as an HF-Dataset skeleton
FEEDBACK_STORE = "data/hf_feedback_dataset.json"

@router.post("/feedback")
async def submit_human_feedback(data: FeedbackData):
    """
    Human-in-the-loop endpoint.
    Recieves physician updates when the LLM hallucinates or NLP extracts incorrectly.
    Stores the feedback to dynamically fine-tune the BioBERT layer and RAG embeddings later.
    """
    os.makedirs(os.path.dirname(FEEDBACK_STORE), exist_ok=True)
    
    # Load existing telemetry
    records = []
    if os.path.exists(FEEDBACK_STORE):
        try:
            with open(FEEDBACK_STORE, "r") as f:
                records = json.load(f)
        except Exception:
            pass
            
    # Append new feedback
    new_record = data.dict()
    records.append(new_record)
    
    try:
        with open(FEEDBACK_STORE, "w") as f:
            json.dump(records, f, indent=2)
        logger.info(f"Feedback successfully registered for {data.entity_id}")
    except Exception as e:
        logger.error(f"Failed to store feedback: {e}")
        raise HTTPException(status_code=500, detail="Storage engine failed")
        
    return {"status": "success", "message": "Feedback ingested into dataset layer."}
