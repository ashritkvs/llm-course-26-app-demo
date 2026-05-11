from __future__ import annotations

import logging
from uuid import uuid4

from supabase import Client

from backend.services.analytics.models import AnalyticsResult

logger = logging.getLogger(__name__)


def persist_analytics_snapshot(
    supabase: Client,
    workspace_id: str,
    user_id: str,
    result: AnalyticsResult,
) -> str:
    """Write an analytics_snapshots row and return the new snapshot id."""
    snapshot_id = str(uuid4())
    payload = {
        "id": snapshot_id,
        "workspace_id": workspace_id,
        "user_id": user_id,
        "concept_mastery_state": {
            k: v.model_dump() for k, v in result.concept_mastery.items()
        },
        "error_distribution": result.error_distribution,
        "performance_trend_summary": [e.model_dump() for e in result.performance_trend],
    }
    supabase.table("analytics_snapshots").insert(payload).execute()
    logger.info("Persisted analytics snapshot %s for workspace %s", snapshot_id, workspace_id)
    return snapshot_id
