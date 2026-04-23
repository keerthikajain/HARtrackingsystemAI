"""schemas.py - All Pydantic request/response models for HAR Router."""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class APIResponse(BaseModel):
    status: str = "success"
    data: Optional[dict] = None
    message: Optional[str] = None


class UploadData(BaseModel):
    filename: str
    rows: int
    columns: int
    message: str


class TrainRequest(BaseModel):
    filename: str = Field(..., description="CSV file already in /data")
    n_pca_components: int = Field(default=50, ge=10, le=200)
    n_clusters: int = Field(default=6, ge=2, le=20)


class TrainData(BaseModel):
    message: str
    n_clusters: int
    n_pca_components: int
    baseline_accuracy: float
    routed_accuracy: float
    accuracy_uplift: float
    cluster_distribution: Dict[str, int]
    models_saved: List[str]


# Predict — accepts a sliding window of sensor readings
class SensorReading(BaseModel):
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class PredictRequest(BaseModel):
    sensor_data: List[SensorReading] = Field(
        ..., min_length=5,
        description="Sliding window of sensor readings (min 5)"
    )


class PredictData(BaseModel):
    predicted_activity: str
    cluster: int
    confidence: float
    probabilities: Dict[str, float]


class LogEntry(BaseModel):
    timestamp: str
    predicted_activity: str
    cluster: int
    probabilities: Dict[str, float]


class LogsData(BaseModel):
    total: int
    logs: List[LogEntry]


class SummaryData(BaseModel):
    total_predictions: int
    activity_distribution: Dict[str, int]
    cluster_distribution: Dict[str, int]


class AccuracyData(BaseModel):
    baseline_accuracy: float
    routed_accuracy: float
    accuracy_uplift: float


class ClusterStat(BaseModel):
    cluster_id: int
    sample_count: int


class ClustersData(BaseModel):
    clusters: List[ClusterStat]
