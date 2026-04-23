"""analytics.py - Analytics dashboard router."""

from fastapi import APIRouter, Query, HTTPException
from schemas import APIResponse, SummaryData, AccuracyData, ClustersData, ClusterStat, LogsData, LogEntry
from services.analytics_service import get_summary, get_accuracy, get_cluster_stats, calculate_calories
from services.logs_service import read_logs

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=APIResponse)
def summary():
    """Total predictions, activity distribution, cluster distribution."""
    try:
        return APIResponse(data=SummaryData(**get_summary()).dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accuracy", response_model=APIResponse)
def accuracy():
    """Baseline vs routed accuracy from the last training run."""
    try:
        return APIResponse(data=AccuracyData(**get_accuracy()).dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters", response_model=APIResponse)
def clusters():
    """Cluster-wise sample counts from the last training run."""
    try:
        stats = [ClusterStat(**s) for s in get_cluster_stats()]
        return APIResponse(data=ClustersData(clusters=stats).dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs", response_model=APIResponse)
def analytics_logs(n: int = Query(default=20, ge=1, le=200)):
    """Recent predictions for the analytics table UI."""
    entries = read_logs(limit=n)
    return APIResponse(data=LogsData(total=len(entries), logs=[LogEntry(**e) for e in entries]).dict())


@router.get("/calories", response_model=APIResponse)
def calories(weight: float = Query(default=70.0, ge=1.0, le=300.0, description="User weight in kg")):
    """
    Estimate calories burned in the last 24 hours.
    Uses MET values × weight × duration from prediction logs.
    """
    try:
        result = calculate_calories(weight_kg=weight)
        return APIResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
