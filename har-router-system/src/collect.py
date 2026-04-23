"""collect.py - Data collection router for recording real phone sensor data."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from schemas import APIResponse, SensorReading
from services.collect_service import save_window, get_collection_stats, export_csv, clear_collection

router = APIRouter(prefix="/collect", tags=["Collect"])


class CollectRequest(BaseModel):
    activity: str
    sensor_data: List[SensorReading]


@router.post("", response_model=APIResponse)
def collect_window(req: CollectRequest):
    """Save a labeled sensor window for training."""
    try:
        result = save_window(req.activity, req.sensor_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return APIResponse(data=result)


@router.get("/stats", response_model=APIResponse)
def collection_stats():
    """Get current collection statistics."""
    return APIResponse(data=get_collection_stats())


@router.post("/export", response_model=APIResponse)
def export_collection(filename: str = "phone_data.csv"):
    """Export collected data to CSV for training."""
    try:
        result = export_csv(filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return APIResponse(data=result)


@router.delete("/clear", response_model=APIResponse)
def clear_data():
    """Clear all collected data."""
    clear_collection()
    return APIResponse(data={"message": "Collection cleared."})
