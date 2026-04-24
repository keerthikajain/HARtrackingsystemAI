"""
config.py - Central configuration for HAR Router system.

Two separate model sets:
  models/sensor/    — trained on raw phone sensor data (ax,ay,az,gx,gy,gz)
                      used by live prediction endpoint
  models/analytics/ — trained on UCI pre-engineered dataset (561 features)
                      used only for analytics/accuracy comparison
"""

from pathlib import Path

# ── Feature & Model Constants ─────────────────────────────────────────────────
N_SENSOR_FEATURES: int = 150   # features extracted from raw phone sensor window
DEFAULT_CLUSTERS:  int = 6

# ── Base Paths ────────────────────────────────────────────────────────────────
BASE_DIR:    Path = Path(__file__).resolve().parent.parent

DATA_DIR:    Path = BASE_DIR / "data"
MODELS_DIR:  Path = BASE_DIR / "models"
LOGS_DIR:    Path = BASE_DIR / "logs"
METRICS_DIR: Path = BASE_DIR / "metrics"

# ── Sensor model paths (live prediction) ─────────────────────────────────────
SENSOR_MODELS_DIR:        Path = MODELS_DIR / "sensor"
SENSOR_SCALER_FILE:       Path = SENSOR_MODELS_DIR / "scaler.pkl"
SENSOR_LABEL_ENCODER_FILE:Path = SENSOR_MODELS_DIR / "label_encoder.pkl"
SENSOR_BASELINE_FILE:     Path = SENSOR_MODELS_DIR / "model_baseline.pkl"
SENSOR_KMEANS_FILE:       Path = SENSOR_MODELS_DIR / "kmeans.pkl"

def sensor_cluster_model_path(cluster_id: int) -> Path:
    return SENSOR_MODELS_DIR / f"model_cluster_{cluster_id}.pkl"

# ── Analytics model paths (UCI training) ─────────────────────────────────────
ANALYTICS_MODELS_DIR:        Path = MODELS_DIR / "analytics"
ANALYTICS_SCALER_FILE:       Path = ANALYTICS_MODELS_DIR / "scaler.pkl"
ANALYTICS_LABEL_ENCODER_FILE:Path = ANALYTICS_MODELS_DIR / "label_encoder.pkl"
ANALYTICS_BASELINE_FILE:     Path = ANALYTICS_MODELS_DIR / "model_baseline.pkl"
ANALYTICS_KMEANS_FILE:       Path = ANALYTICS_MODELS_DIR / "kmeans.pkl"

def analytics_cluster_model_path(cluster_id: int) -> Path:
    return ANALYTICS_MODELS_DIR / f"model_cluster_{cluster_id}.pkl"

# ── Metrics & Logs ────────────────────────────────────────────────────────────
METRICS_FILE:  Path = METRICS_DIR / "training.json"        # written by UCI training
LOGS_FILE:     Path = LOGS_DIR / "predictions.jsonl"       # legacy ref only
FEEDBACK_FILE: Path = LOGS_DIR / "feedback.jsonl"          # legacy ref only

# ── Legacy flat paths (kept for backward compat with old .pkl files) ──────────
SCALER_FILE:        Path = MODELS_DIR / "scaler.pkl"
KMEANS_FILE:        Path = MODELS_DIR / "kmeans.pkl"
LABEL_ENCODER_FILE: Path = MODELS_DIR / "label_encoder.pkl"
BASELINE_MODEL_FILE:Path = MODELS_DIR / "model_baseline.pkl"

def cluster_model_path(cluster_id: int) -> Path:
    return MODELS_DIR / f"model_cluster_{cluster_id}.pkl"

# ── Ensure directories exist ──────────────────────────────────────────────────
for _d in (DATA_DIR, MODELS_DIR, LOGS_DIR, METRICS_DIR,
           SENSOR_MODELS_DIR, ANALYTICS_MODELS_DIR):
    _d.mkdir(parents=True, exist_ok=True)
