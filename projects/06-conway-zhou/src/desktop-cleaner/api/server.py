"""
FastAPI application — Desktop Cleaner API server.
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import scan, categories, organize, deletion, settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Desktop Cleaner API",
    description="REST API for the Desktop Cleaner application.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow all origins for local development
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(scan.router, tags=["Scan"])
app.include_router(categories.router, tags=["Categories"])
app.include_router(organize.router, tags=["Organise"])
app.include_router(deletion.router, tags=["Deletion"])
app.include_router(settings.router, tags=["Settings"])


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    """Initialises logging when the API server starts."""
    from src.utils import setup_logging
    setup_logging()
    logger.info("Desktop Cleaner API server started.")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
