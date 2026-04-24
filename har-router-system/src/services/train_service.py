"""
train_service.py - HAR Router ML training pipeline.

Two modes detected automatically:
  UCI mode  (≥200 feature cols) → saves to models/analytics/  + metrics/training.json
  Sensor mode (6 raw axis cols) → saves to models/sensor/

Both modes:
  1. StandardScaler
  2. Baseline global Random Forest
  3. k-means clustering
  4. One specialist RF per cluster
  5. Routed accuracy = route each test sample to its cluster model
  6. Save F1, Precision, Recall, Confusion Matrix
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score, confusion_matrix,
    roc_auc_score, silhouette_score
)
from fastapi import HTTPException
from config import (
    DATA_DIR, METRICS_FILE,
    SENSOR_MODELS_DIR, SENSOR_SCALER_FILE, SENSOR_LABEL_ENCODER_FILE,
    SENSOR_BASELINE_FILE, SENSOR_KMEANS_FILE, sensor_cluster_model_path,
    ANALYTICS_MODELS_DIR, ANALYTICS_SCALER_FILE, ANALYTICS_LABEL_ENCODER_FILE,
    ANALYTICS_BASELINE_FILE, ANALYTICS_KMEANS_FILE, analytics_cluster_model_path,
    N_SENSOR_FEATURES,
)
from services.feature_extraction import extract_features_from_arrays, N_FEATURES

WINDOW_SIZE = 50
STEP_SIZE   = 25


# ── Column detection ──────────────────────────────────────────────────────────

def _detect_columns(df):
    col_lower = {c.lower(): c for c in df.columns}
    activity_col = col_lower.get("activity", col_lower.get("label"))
    subject_col  = col_lower.get("subject",  col_lower.get("user"))
    if activity_col is None:
        raise HTTPException(status_code=400, detail="Dataset must have an 'Activity' or 'Label' column.")
    meta = [c for c in [activity_col, subject_col] if c]
    feature_cols = [c for c in df.columns if c not in meta and pd.api.types.is_numeric_dtype(df[c])]
    if not feature_cols:
        raise HTTPException(status_code=400, detail="No numeric feature columns found.")
    return activity_col, feature_cols


def _find_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    for c in candidates:
        matches = [col for col in df.columns if c.lower() in col.lower()]
        if matches:
            return matches[0]
    return None


def _is_uci_dataset(feature_cols) -> bool:
    """True if this looks like a pre-engineered dataset (UCI 561-feature format)."""
    return len(feature_cols) >= 200


# ── Feature builders ──────────────────────────────────────────────────────────

def _build_windows(df, activity_col, feature_cols):
    """Raw sensor CSV → sliding windows → 150 statistical features each.
    Windows are built per-activity to avoid mixing activities at boundaries.
    """
    ax_col = _find_col(df, ["tBodyAcc-mean()-X", "acc_x", "ax"])
    ay_col = _find_col(df, ["tBodyAcc-mean()-Y", "acc_y", "ay"])
    az_col = _find_col(df, ["tBodyAcc-mean()-Z", "acc_z", "az"])
    gx_col = _find_col(df, ["tBodyGyro-mean()-X", "gyro_x", "gx"])
    gy_col = _find_col(df, ["tBodyGyro-mean()-Y", "gyro_y", "gy"])
    gz_col = _find_col(df, ["tBodyGyro-mean()-Z", "gyro_z", "gz"])

    if all([ax_col, ay_col, az_col, gx_col, gy_col, gz_col]):
        axis_cols = [ax_col, ay_col, az_col, gx_col, gy_col, gz_col]
    else:
        axis_cols = (feature_cols[:6] + feature_cols[:6])[:6]
        print(f"[train] Axis columns not found — proxy: {axis_cols}")

    print(f"[train] Axis columns: {axis_cols}")

    X_list, y_list = [], []

    # Window per activity group to avoid cross-activity contamination
    for activity, group in df.groupby(activity_col):
        sensor_data = group[axis_cols].values.astype(float)
        n = len(sensor_data)
        for start in range(0, n - WINDOW_SIZE + 1, STEP_SIZE):
            end    = start + WINDOW_SIZE
            window = sensor_data[start:end]
            feat   = extract_features_from_arrays(
                window[:, 0], window[:, 1], window[:, 2],
                window[:, 3], window[:, 4], window[:, 5],
            )
            X_list.append(feat)
            y_list.append(str(activity))

    if not X_list:
        raise HTTPException(status_code=400, detail=f"Dataset too small. Need at least {WINDOW_SIZE} rows.")

    X = np.vstack(X_list)
    y = np.array(y_list)
    print(f"[train] Built {len(X)} windows from {len(df)} rows (window={WINDOW_SIZE}, step={STEP_SIZE})")
    for act in np.unique(y):
        print(f"[train]   {act}: {np.sum(y == act)} windows")
    return X, y


def _build_from_rows(df, activity_col, feature_cols):
    """UCI pre-engineered CSV → use all feature columns directly (one row = one sample)."""
    X = df[feature_cols].values.astype(float)
    y = df[activity_col].values.astype(str)
    print(f"[train] UCI mode: using all {len(feature_cols)} columns, {len(X)} samples")
    return X, y


# ── Evaluation ────────────────────────────────────────────────────────────────

def _eval(y_true, y_pred, y_proba, classes):
    """Compute accuracy, macro-F1, precision, recall, confusion matrix, ROC-AUC."""
    metrics = {
        "accuracy":         round(float(accuracy_score(y_true, y_pred)), 4),
        "f1":               round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "precision":        round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "recall":           round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classes":          [str(c) for c in classes],
        "roc_auc":          None,
    }
    # ROC-AUC — only works when all classes are present in y_true
    try:
        if y_proba is not None and len(np.unique(y_true)) > 1:
            metrics["roc_auc"] = round(float(
                roc_auc_score(y_true, y_proba, multi_class="ovr", average="macro")
            ), 4)
    except Exception as e:
        print(f"[train] ROC-AUC skipped: {e}")
    return metrics


# ── Core training logic (shared) ──────────────────────────────────────────────

def _run_pipeline(X_raw, y_raw, n_clusters, models_dir, cluster_path_fn):
    """
    Shared training pipeline for both UCI and sensor modes.
    Returns metrics dict + saves all models to models_dir.
    """
    y_raw = np.array([str(v) for v in y_raw])

    le = LabelEncoder()
    y  = le.fit_transform(y_raw)
    print(f"[train] Classes: {list(le.classes_)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler         = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # ── Baseline RF ───────────────────────────────────────────────────────────
    print("[train] Fitting baseline RandomForest...")
    baseline_rf = RandomForestClassifier(
        n_estimators=200, max_depth=15, min_samples_split=5,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    baseline_rf.fit(X_train_scaled, y_train)
    y_pred_baseline  = baseline_rf.predict(X_test_scaled)
    y_proba_baseline = baseline_rf.predict_proba(X_test_scaled)
    baseline_m = _eval(y_test, y_pred_baseline, y_proba_baseline, le.classes_)
    print(f"[train] Baseline accuracy={baseline_m['accuracy']:.4f}  F1={baseline_m['f1']:.4f}  ROC-AUC={baseline_m['roc_auc']}")

    # ── k-means ───────────────────────────────────────────────────────────────
    print(f"[train] Running k-means k={n_clusters}...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    train_clusters = kmeans.fit_predict(X_train_scaled)
    test_clusters  = kmeans.predict(X_test_scaled)

    cluster_dist = {str(c): int(np.sum(train_clusters == c)) for c in range(n_clusters)}
    print(f"[train] Cluster distribution: {cluster_dist}")
    silhouette = None
    try:
        # Sample max 10,000 points for speed
        sample_size = min(10000, len(X_train_scaled))
        idx_sample  = np.random.choice(len(X_train_scaled), sample_size, replace=False)
        silhouette  = round(float(silhouette_score(
            X_train_scaled[idx_sample], train_clusters[idx_sample]
        )), 4)
        print(f"[train] Silhouette Score: {silhouette}")
    except Exception as e:
        print(f"[train] Silhouette skipped: {e}")

    cluster_dist = {str(c): int(np.sum(train_clusters == c)) for c in range(n_clusters)}
    print(f"[train] Cluster distribution: {cluster_dist}")

    # ── Per-cluster RF ────────────────────────────────────────────────────────
    cluster_models  = {}
    cluster_metrics = {}

    for c in range(n_clusters):
        idx = np.where(train_clusters == c)[0]
        if len(idx) < 10 or len(np.unique(y_train[idx])) < 2:
            print(f"[train] Cluster {c}: {len(idx)} samples — skipping")
            continue

        print(f"[train] Fitting cluster-{c} RF on {len(idx)} samples...")
        rf_c = RandomForestClassifier(
            n_estimators=150, max_depth=12, min_samples_split=5,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        rf_c.fit(X_train_scaled[idx], y_train[idx])
        cluster_models[c] = rf_c

        test_idx = np.where(test_clusters == c)[0]
        if len(test_idx) > 0:
            acc_c = round(float(accuracy_score(y_test[test_idx], rf_c.predict(X_test_scaled[test_idx]))), 4)
            cluster_metrics[str(c)] = {"accuracy": acc_c, "n_test": len(test_idx)}
            print(f"[train] Cluster {c} accuracy={acc_c:.4f} on {len(test_idx)} test samples")

    # ── Routed accuracy ───────────────────────────────────────────────────────
    n_classes      = len(le.classes_)
    y_pred_routed  = np.copy(y_pred_baseline)
    y_proba_routed = y_proba_baseline.copy()

    for c, rf_c in cluster_models.items():
        idx = np.where(test_clusters == c)[0]
        if len(idx) == 0:
            continue
        y_pred_routed[idx] = rf_c.predict(X_test_scaled[idx])
        # Map cluster model probabilities back to full class space
        cluster_proba = rf_c.predict_proba(X_test_scaled[idx])
        full_proba    = np.zeros((len(idx), n_classes))
        for j, cls in enumerate(rf_c.classes_):
            if cls < n_classes:
                full_proba[:, cls] = cluster_proba[:, j]
        y_proba_routed[idx] = full_proba

    routed_m = _eval(y_test, y_pred_routed, y_proba_routed, le.classes_)
    uplift   = round(routed_m["accuracy"] - baseline_m["accuracy"], 4)
    print(f"[train] Routed accuracy={routed_m['accuracy']:.4f}  F1={routed_m['f1']:.4f}  ROC-AUC={routed_m['roc_auc']}  uplift={uplift:+.4f}")

    # ── Save models ───────────────────────────────────────────────────────────
    joblib.dump(scaler,      models_dir / "scaler.pkl")
    joblib.dump(le,          models_dir / "label_encoder.pkl")
    joblib.dump(baseline_rf, models_dir / "model_baseline.pkl")
    joblib.dump(kmeans,      models_dir / "kmeans.pkl")

    models_saved = ["scaler.pkl", "label_encoder.pkl", "model_baseline.pkl", "kmeans.pkl"]

    # Remove stale cluster models
    i = 0
    while (models_dir / f"model_cluster_{i}.pkl").exists():
        (models_dir / f"model_cluster_{i}.pkl").unlink()
        i += 1

    for c, rf_c in cluster_models.items():
        path = cluster_path_fn(c)
        joblib.dump(rf_c, path)
        models_saved.append(f"model_cluster_{c}.pkl")

    return {
        "n_train":          len(X_train),
        "n_test":           len(X_test),
        "n_features":       X_raw.shape[1],
        "classes":          [str(c) for c in le.classes_],
        "cluster_dist":     cluster_dist,
        "cluster_metrics":  cluster_metrics,
        "n_cluster_models": len(cluster_models),
        "baseline":         baseline_m,
        "routed":           routed_m,
        "uplift":           uplift,
        "models_saved":     models_saved,
        "silhouette_score": silhouette,
    }


# ── Public entry point ────────────────────────────────────────────────────────

def run_training(filename: str, n_pca_components: int, n_clusters: int) -> dict:
    csv_path = DATA_DIR / filename
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail=f"'{filename}' not found in /data.")

    df = pd.read_csv(csv_path)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    activity_col, feature_cols = _detect_columns(df)
    uci_mode = _is_uci_dataset(feature_cols)

    if uci_mode:
        print(f"[train] UCI mode detected ({len(feature_cols)} feature cols)")
        X_raw, y_raw  = _build_from_rows(df, activity_col, feature_cols)
        models_dir    = ANALYTICS_MODELS_DIR
        cluster_fn    = analytics_cluster_model_path
    else:
        print(f"[train] Sensor mode detected ({len(feature_cols)} feature cols)")
        X_raw, y_raw  = _build_windows(df, activity_col, feature_cols)
        models_dir    = SENSOR_MODELS_DIR
        cluster_fn    = sensor_cluster_model_path

    result = _run_pipeline(X_raw, y_raw, n_clusters, models_dir, cluster_fn)

    # ── Save metrics (UCI training only — this is what Analytics page reads) ──
    if uci_mode:
        metrics = {
            "timestamp":          datetime.now(timezone.utc).isoformat(),
            "mode":               "uci",
            "n_features":         result["n_features"],
            "n_clusters":         n_clusters,
            "n_cluster_models":   result["n_cluster_models"],
            "n_train_windows":    result["n_train"],
            "n_test_windows":     result["n_test"],
            "classes":            result["classes"],
            "cluster_distribution": result["cluster_dist"],
            "cluster_metrics":    result["cluster_metrics"],
            "silhouette_score":   result["silhouette_score"],
            "baseline":           result["baseline"],
            "routed":             result["routed"],
            "baseline_accuracy":  result["baseline"]["accuracy"],
            "routed_accuracy":    result["routed"]["accuracy"],
            "accuracy_uplift":    result["uplift"],
        }
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"[train] UCI metrics saved → {METRICS_FILE}")
    else:
        # Also save sensor training metrics so Analytics page can show them
        metrics = {
            "timestamp":          datetime.now(timezone.utc).isoformat(),
            "mode":               "sensor",
            "n_features":         result["n_features"],
            "n_clusters":         n_clusters,
            "n_cluster_models":   result["n_cluster_models"],
            "n_train_windows":    result["n_train"],
            "n_test_windows":     result["n_test"],
            "classes":            result["classes"],
            "cluster_distribution": result["cluster_dist"],
            "cluster_metrics":    result["cluster_metrics"],
            "silhouette_score":   result["silhouette_score"],
            "baseline":           result["baseline"],
            "routed":             result["routed"],
            "baseline_accuracy":  result["baseline"]["accuracy"],
            "routed_accuracy":    result["routed"]["accuracy"],
            "accuracy_uplift":    result["uplift"],
        }
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"[train] Sensor metrics saved → {METRICS_FILE}")

    return {
        "message":              f"Training complete ({'UCI analytics' if uci_mode else 'sensor prediction'} mode).",
        "n_features":           result["n_features"],
        "window_size":          WINDOW_SIZE if not uci_mode else 0,
        "n_train_windows":      result["n_train"],
        "n_test_windows":       result["n_test"],
        "classes":              result["classes"],
        "models_saved":         result["models_saved"],
        "n_clusters":           n_clusters,
        "n_pca_components":     0,
        "n_cluster_models":     result["n_cluster_models"],
        "cluster_distribution": result["cluster_dist"],
        "cluster_metrics":      result["cluster_metrics"],
        "baseline_accuracy":    result["baseline"]["accuracy"],
        "baseline_f1":          result["baseline"]["f1"],
        "routed_accuracy":      result["routed"]["accuracy"],
        "routed_f1":            result["routed"]["f1"],
        "accuracy_uplift":      result["uplift"],
        "silhouette_score":     result["silhouette_score"],
        "baseline_roc_auc":     result["baseline"]["roc_auc"],
        "routed_roc_auc":       result["routed"]["roc_auc"],
        "confusion_matrix_baseline": result["baseline"]["confusion_matrix"],
        "confusion_matrix_routed":   result["routed"]["confusion_matrix"],
    }
