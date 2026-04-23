from pathlib import Path

# ðŸ”¹ Feature & Model Constants
EXPECTED_FEATURES: int = 24   # âœ… FIXED
DEFAULT_CLUSTERS: int = 6

# ðŸ”¹ Base Paths
BASE_DIR: Path = Path(__file__).resolve().parent.parent

DATA_DIR: Path = BASE_DIR / "data"
MODELS_DIR: Path = BASE_DIR / "models"
LOGS_DIR: Path = BASE_DIR / "logs"
METRICS_DIR: Path = BASE_DIR / "metrics"

# ðŸ”¹ File Paths
LOGS_FILE: Path = LOGS_DIR / "predictions.jsonl"
METRICS_FILE: Path = METRICS_DIR / "training.json"
FEEDBACK_FILE: Path = LOGS_DIR / "feedback.jsonl"

# ðŸ”¹ Model Files
SCALER_FILE: Path = MODELS_DIR / "scaler.pkl"
PCA_FILE: Path = MODELS_DIR / "pca.pkl"
KMEANS_FILE: Path = MODELS_DIR / "kmeans.pkl"
LABEL_ENCODER_FILE: Path = MODELS_DIR / "label_encoder.pkl"
BASELINE_MODEL_FILE: Path = MODELS_DIR / "model_baseline.pkl"


def cluster_model_path(cluster_id: int) -> Path:
    return MODELS_DIR / f"model_cluster_{cluster_id}.pkl"


# ðŸ”¹ Ensure Required Directories Exist
for directory in (DATA_DIR, MODELS_DIR, LOGS_DIR, METRICS_DIR):
    directory.mkdir(parents=True, exist_ok=True)
