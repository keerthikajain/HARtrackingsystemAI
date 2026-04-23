"""logs.py - Prediction logs router."""

from fastapi import APIRouter, Query, HTTPException
from schemas import APIResponse, LogsData, LogEntry
from services.logs_service import read_logs, clear_logs

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("", response_model=APIResponse)
def get_logs(
    limit: int    = Query(default=50, ge=1, le=500),
    activity: str = Query(default=None, description="Filter by activity label"),
):
    """Return prediction logs, most recent first."""
    entries = read_logs(limit=limit, activity_filter=activity)
    return APIResponse(data=LogsData(total=len(entries), logs=[LogEntry(**e) for e in entries]).dict())


@router.get("/recent", response_model=APIResponse)
def get_recent(n: int = Query(default=10, ge=1, le=100)):
    """Return the N most recent predictions."""
    entries = read_logs(limit=n)
    return APIResponse(data=LogsData(total=len(entries), logs=[LogEntry(**e) for e in entries]).dict())


@router.delete("", response_model=APIResponse)
def delete_logs():
    """Clear all prediction logs."""
    clear_logs()
    return APIResponse(data={"message": "All logs cleared."})
