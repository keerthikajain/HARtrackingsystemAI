"""registry.py - Model registry API endpoints."""

from fastapi import APIRouter, HTTPException
from schemas import APIResponse
from services.db_service import get_model_registry, get_routing_stats

router = APIRouter(prefix="/registry", tags=["Registry"])


@router.get("/models", response_model=APIResponse)
def list_models():
    """Return all active models from the PostgreSQL registry."""
    try:
        entries = get_model_registry()
        # Convert timestamps to strings for JSON serialization
        for e in entries:
            if e.get("training_timestamp"):
                e["training_timestamp"] = str(e["training_timestamp"])
        return APIResponse(data={"models": entries, "total": len(entries)})
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Registry unavailable: {e}")


@router.get("/routing-stats", response_model=APIResponse)
def routing_stats():
    """Return routing statistics from PostgreSQL."""
    try:
        stats = get_routing_stats()
        for row in stats.get("by_cluster", []):
            if row.get("last_used"):
                row["last_used"] = str(row["last_used"])
            if row.get("avg_confidence"):
                row["avg_confidence"] = round(float(row["avg_confidence"]), 4)
        return APIResponse(data=stats)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Registry unavailable: {e}")
