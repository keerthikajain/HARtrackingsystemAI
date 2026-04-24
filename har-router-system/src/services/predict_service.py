"""
predict_service.py - Model loading and prediction pipeline with cluster routing.

Inference pipeline:
  1. Extract 150 features from sensor window
  2. StandardScaler normalise
  3. k-means assigns cluster
  4. Cluster-specific RF predicts (falls back to baseline if cluster model missing)
  5. Temporal smoothing applied
"""

import os
import collections
import numpy as np
import joblib
from fastapi import HTTPException
from config import (
    SENSOR_MODELS_DIR, SENSOR_SCALER_FILE, SENSOR_LABEL_ENCODER_FILE,
    SENSOR_BASELINE_FILE, SENSOR_KMEANS_FILE, sensor_cluster_model_path,
    N_SENSOR_FEATURES,
)
from services.feature_extraction import extract_features_from_window, N_FEATURES

_HISTORY_SIZE = 5
_prediction_history: collections.deque = collections.deque(maxlen=_HISTORY_SIZE)


class ModelRegistry:
    def __init__(self):
        self.scaler          = None
        self.label_encoder   = None
        self.baseline_model  = None
        self.kmeans          = None
        self.cluster_models  = {}   # {cluster_id: RandomForestClassifier}
        self.ready           = False

    def load(self):
        required = ["scaler.pkl", "label_encoder.pkl", "model_baseline.pkl"]
        missing  = [f for f in required if not (SENSOR_MODELS_DIR / f).exists()]
        if missing:
            raise HTTPException(
                status_code=503,
                detail=f"Sensor models not ready. Missing: {missing}. Upload raw sensor CSV and run POST /train first."
            )

        self.scaler         = joblib.load(SENSOR_SCALER_FILE)
        self.label_encoder  = joblib.load(SENSOR_LABEL_ENCODER_FILE)
        self.baseline_model = joblib.load(SENSOR_BASELINE_FILE)

        # Load k-means if available
        if SENSOR_KMEANS_FILE.exists():
            self.kmeans = joblib.load(SENSOR_KMEANS_FILE)
            print(f"[registry] Sensor k-means loaded (k={self.kmeans.n_clusters})")
        else:
            self.kmeans = None
            print("[registry] No sensor kmeans.pkl — routing disabled, using baseline only")

        # Load all cluster-specific sensor models
        self.cluster_models = {}
        i = 0
        while True:
            path = sensor_cluster_model_path(i)
            if path.exists():
                self.cluster_models[i] = joblib.load(path)
                i += 1
            else:
                break

        self.ready = True
        print(
            f"[registry] Sensor models loaded."
            f" scaler expects {self.scaler.n_features_in_} features"
            f" | classes={list(self.label_encoder.classes_)}"
            f" | cluster_models={list(self.cluster_models.keys())}"
        )

    def reload(self):
        self.ready = False
        _prediction_history.clear()
        self.load()


registry = ModelRegistry()


def run_prediction(sensor_data: list) -> dict:
    """
    Predict activity from a window of sensor readings.

    Pipeline:
      extract features → scale → k-means cluster → cluster RF (or baseline) → label
    """
    if not registry.ready:
        raise HTTPException(status_code=503, detail="Models not loaded. Run POST /train first.")

    # ── Feature extraction ────────────────────────────────────────────────────
    features = extract_features_from_window(sensor_data)

    if features.shape[0] != N_FEATURES:
        raise HTTPException(
            status_code=500,
            detail=f"Feature size mismatch: got {features.shape[0]}, expected {N_FEATURES}."
        )

    X        = features.reshape(1, -1)
    X_scaled = registry.scaler.transform(X)

    # ── Cluster routing ───────────────────────────────────────────────────────
    cluster_id = 0
    if registry.kmeans is not None:
        cluster_id = int(registry.kmeans.predict(X_scaled)[0])

    # Pick cluster model if available, else fall back to baseline
    if cluster_id in registry.cluster_models:
        model      = registry.cluster_models[cluster_id]
        model_used = f"cluster_{cluster_id}"
    else:
        model      = registry.baseline_model
        model_used = "baseline"

    print(f"[predict] window={len(sensor_data)} | cluster={cluster_id} | model={model_used}")

    # ── Inference ─────────────────────────────────────────────────────────────
    proba   = model.predict_proba(X_scaled)[0]
    classes = model.classes_

    # Map encoded class indices back to string labels
    labels        = registry.label_encoder.inverse_transform(classes)
    top_idx       = int(np.argmax(proba))
    activity      = str(labels[top_idx])
    confidence    = round(float(proba[top_idx]), 4)
    probabilities = {str(lbl): round(float(p), 4) for lbl, p in zip(labels, proba)}

    # Fill in any missing classes with 0 probability (cluster models may not have all classes)
    all_classes = list(registry.label_encoder.classes_)
    for cls in all_classes:
        if cls not in probabilities:
            probabilities[cls] = 0.0

    top3 = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)[:3]
    print(f"[predict] → {activity} | confidence={confidence} | top3={top3}")

    # ── Temporal smoothing ────────────────────────────────────────────────────
    previous_activity = _prediction_history[-1] if _prediction_history else None
    _prediction_history.append(activity)

    if len(_prediction_history) >= 3:
        counts = collections.Counter(_prediction_history)
        common, freq = counts.most_common(1)[0]
        if common in probabilities and freq / len(_prediction_history) >= 0.6:
            probabilities[common] = min(1.0, probabilities[common] + 0.04)
            total = sum(probabilities.values())
            probabilities = {k: round(v / total, 4) for k, v in probabilities.items()}

    return {
        "predicted_activity": activity,
        "cluster":            cluster_id,
        "model_used":         model_used,
        "confidence":         confidence,
        "probabilities":      probabilities,
        "previous_activity":  previous_activity,
    }
