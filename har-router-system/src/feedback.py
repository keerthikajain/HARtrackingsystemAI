"""
feedback.py - Human-in-the-loop feedback endpoint.
Stores user corrections in PostgreSQL for future retraining.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.db_service import db_append_feedback, db_read_feedback, db_count_feedback

router = APIRouter(prefix="/feedback", tags=["Feedback"])

ACTIVITIES = [
    "WALKING", "WALKING_UPSTAIRS", "WALKING_DOWNSTAIRS",
    "SITTING", "STANDING", "LAYING",
]


class SensorReading(BaseModel):
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class FeedbackRequest(BaseModel):
    sensor_data:        List[SensorReading]
    predicted_activity: str
    actual_activity:    str


@router.post("", response_model=dict)
def submit_feedback(req: FeedbackRequest):
    """
    Store a user correction for a wrong prediction into PostgreSQL.
    """
    if req.actual_activity not in ACTIVITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid activity. Must be one of: {ACTIVITIES}",
        )

    try:
        db_append_feedback(
            predicted_activity=req.predicted_activity,
            actual_activity=req.actual_activity,
            sensor_data=[r.dict() for r in req.sensor_data],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {e}")

    total = db_count_feedback()

    return {
        "status": "success",
        "data": {
            "message": "Feedback recorded. Thank you for helping improve the model.",
            "total_feedback": total,
        },
    }


@router.get("", response_model=dict)
def get_feedback(limit: int = 50):
    """Return stored feedback entries from PostgreSQL, most recent first."""
    entries = db_read_feedback(limit=limit)
    return {
        "status": "success",
        "data": {"total": len(entries), "entries": entries},
    }
