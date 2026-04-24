"""schemas.py - All Pydantic request/response models for HAR Router."""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class APIResponse(BaseModel):
    status: str = "success"
    data: Optional[dict] = None
    message: Optional[str] = None


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadData(BaseModel):
    filename: str
    rows: int
    columns: int
    message: str


# ── Train ─────────────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    filename: str = Field(..., description="CSV file already in /data")
    n_pca_components: int = Field(default=50, ge=10, le=200)
    n_clusters: int = Field(default=6, ge=2, le=20)


class TrainData(BaseModel):
    message:                    str
    n_clusters:                 int
    n_pca_components:           int
    baseline_accuracy:          float
    routed_accuracy:            float
    accuracy_uplift:            float
    cluster_distribution:       Dict[str, int]
    models_saved:               List[str]
    n_cluster_models:           Optional[int]   = None
    baseline_f1:                Optional[float] = None
    routed_f1:                  Optional[float] = None
    cluster_metrics:            Optional[dict]  = None
    confusion_matrix_baseline:  Optional[list]  = None
    confusion_matrix_routed:    Optional[list]  = None
    classes:                    Optional[List[str]] = None
    n_features:                 Optional[int]   = None
    window_size:                Optional[int]   = None
    n_train_windows:            Optional[int]   = None
    n_test_windows:             Optional[int]   = None


# ── Predict ───────────────────────────────────────────────────────────────────

class SensorReading(BaseModel):
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


class PredictRequest(BaseModel):
    sensor_data: List[SensorReading] = Field(
        ...,
        min_length=5,
        description="Sliding window of sensor readings (min 5)",
    )


class PredictData(BaseModel):
    predicted_activity: str
    cluster: int
    confidence: float
    probabilities: Dict[str, float]
    previous_activity: Optional[str] = None


# ── Logs ──────────────────────────────────────────────────────────────────────

class LogEntry(BaseModel):
    timestamp: str
    predicted_activity: str
    cluster: int
    probabilities: Dict[str, float]


class LogsData(BaseModel):
    total: int
    logs: List[LogEntry]


# ── Analytics ─────────────────────────────────────────────────────────────────

class SummaryData(BaseModel):
    total_predictions: int
    activity_distribution: Dict[str, int]
    cluster_distribution: Dict[str, int]


class AccuracyData(BaseModel):
    baseline_accuracy:  float
    routed_accuracy:    float
    accuracy_uplift:    float
    baseline_f1:        Optional[float] = None
    routed_f1:          Optional[float] = None
    baseline_precision: Optional[float] = None
    routed_precision:   Optional[float] = None
    baseline_recall:    Optional[float] = None
    routed_recall:      Optional[float] = None
    n_clusters:         Optional[int]   = None
    n_cluster_models:   Optional[int]   = None
    baseline_roc_auc:   Optional[float] = None
    routed_roc_auc:     Optional[float] = None
    silhouette_score:   Optional[float] = None


class ClusterStat(BaseModel):
    cluster_id:        int
    sample_count:      int
    routing_count:     Optional[int]   = None
    cluster_accuracy:  Optional[float] = None


class ClustersData(BaseModel):
    clusters: List[ClusterStat]
