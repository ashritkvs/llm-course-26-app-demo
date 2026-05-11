from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.api.endpoints import router
from app.core.config import settings


# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
)

# Create FastAPI app
app = FastAPI(
    title="TA Reply Copilot API",
    description="Course assistant API for student Q&A and TA draft replies",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api/v1", tags=["ta-reply-copilot"])


@app.on_event("startup")
async def startup_event():
    """Run on startup."""
    logger.info("TA Reply Copilot API starting up...")

    # Ensure data directories exist
    settings.get_faiss_index_path()
    settings.get_document_store_path()

    # Try to load existing index
    from app.services.indexer import indexer
    if indexer.load_index():
        logger.info("Loaded existing FAISS index")
    else:
        logger.warning("No existing index found")

    # Pre-warm the retriever for faster first request
    from app.services.retriever import retriever
    retriever.warmup()


@app.on_event("shutdown")
async def shutdown_event():
    """Run on shutdown."""
    logger.info("TA Reply Copilot API shutting down...")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "TA Reply Copilot API",
        "version": "1.0.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
