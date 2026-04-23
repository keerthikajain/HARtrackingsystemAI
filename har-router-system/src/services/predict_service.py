"""predict_service.py - Model loading and prediction with KMeans routing."""

import os
import collections
import numpy as np
import joblib
from fastapi import HTTPException
from config import MODELS_DIR
from services.db_service import log_routing
from services.feature_extraction import extract_features_from_window, N_FEATURES

_prediction_history = collections.deque(maxlen=5)


class ModelRegistry:
    def __init__(self):
        self.scaler         = None
        self.label_encoder  = None
        self.baseline       = None
        self.kmeans         = None
        self.cluster_models = {}
        self.ready          = False

    def load(self):
        required = ["scaler.pkl", "label_encoder.pkl", "model_baseline.pkl", "kmeans.pkl"]
        missing  = [f for f in required if not os.path.exists(os.path.join(MODELS_DIR, f))]
        if missing:
            raise HTTPException(status_code=503,
                detail=f"Models not ready. Missing: {missing}. Run POST /train first.")

        self.scaler        = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))
        self.label_encoder = joblib.load(os.path.join(MODELS_DIR, "label_encoder.pkl"))
        self.baseline      = joblib.load(os.path.join(MODELS_DIR, "model_baseline.pkl"))
        self.kmeans        = joblib.load(os.path.join(MODELS_DIR, "kmeans.pkl"))

        # Load all cluster specialist models
        self.cluster_models = {}
        i = 0
        while os.path.exists(os.path.join(MODELS_DIR, f"model_cluster_{i}.pkl")):
            self.cluster_models[i] = joblib.load(os.path.join(MODELS_DIR, f"model_cluster_{i}.pkl"))
            i += 1

        self.ready = True
        print(f"[registry] Loaded. features={self.scaler.n_features_in_} "
              f"clusters={list(self.cluster_models.keys())} "
              f"classes={list(self.label_encoder.classes_)}")

    def reload(self):
        self.ready = False
        _prediction_history.clear()
        self.load()


registry = ModelRegistry()


def run_prediction(sensor_data: list) -> dict:
    if not registry.ready:
        raise HTTPException(status_code=503, detail="Models not loaded. Run POST /train first.")

    features = extract_features_from_window(sensor_data)
    print(f"[predict] window={len(sensor_data)} | features={features.shape[0]} "
          f"| mean={features.mean():.3f} | std={features.std():.3f}")

    if features.shape[0] != N_FEATURES:
        raise HTTPException(status_code=500,
            detail=f"Feature size mismatch: got {features.shape[0]}, expected {N_FEATURES}.")

    X        = features.reshape(1, -1)
    X_scaled = registry.scaler.transform(X)

    # â”€â”€ KMeans routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    cluster = int(registry.kmeans.predict(X_scaled)[0])
    model   = registry.cluster_models.get(cluster, registry.baseline)

    proba   = model.predict_proba(X_scaled)[0]
    classes = model.classes_
    labels  = registry.label_encoder.inverse_transform(classes)

    top_idx    = int(np.argmax(proba))
    activity   = str(labels[top_idx])
    confidence = round(float(proba[top_idx]), 4)
    probabilities = {str(lbl): round(float(p), 4) for lbl, p in zip(labels, proba)}

    top3 = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)[:3]
    # Log routing decision to PostgreSQL
    log_routing(cluster, activity, confidence)
    print(f"[predict] cluster={cluster} -> {activity} | conf={confidence} | top3={top3}")

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
        "cluster":            cluster,
        "confidence":         confidence,
        "probabilities":      probabilities,
        "previous_activity":  previous_activity,
    }