"""train_service.py - HAR Router ML training pipeline with KMeans routing."""

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
from sklearn.metrics import accuracy_score, classification_report
from fastapi import HTTPException
from config import DATA_DIR, MODELS_DIR, METRICS_FILE
from services.db_service import init_db, save_model_registry
from services.feature_extraction import N_FEATURES, _ACC_NORM, _GYRO_NORM
from services.feature_extraction import extract_features_from_arrays

WINDOW_SIZE = 50
STEP_SIZE   = 25
ACTIVITY_MAP = {1:"WALKING",2:"WALKING_UPSTAIRS",3:"WALKING_DOWNSTAIRS",4:"SITTING",5:"STANDING",6:"LAYING"}


def _detect_columns(df):
    col_lower = {c.lower(): c for c in df.columns}
    activity_col = col_lower.get("activity", col_lower.get("label"))
    if activity_col is None:
        raise HTTPException(status_code=400, detail="Dataset must have an Activity or Label column.")
    meta = [c for c in [activity_col, col_lower.get("subject")] if c]
    feature_cols = [c for c in df.columns if c not in meta and pd.api.types.is_numeric_dtype(df[c])]
    if not feature_cols:
        raise HTTPException(status_code=400, detail="No numeric feature columns found.")
    return activity_col, feature_cols


def _is_raw_sensor_csv(df, feature_cols):
    raw_cols = {"ax", "ay", "az", "gx", "gy", "gz"}
    return raw_cols.issubset({c.lower() for c in feature_cols})


def _select_uci_features(df, feature_cols):
    reproducible = [c for c in feature_cols
                    if any(s in c.lower() for s in ["-mean()","-std()","-mad()","-max()","-min()","-energy()","-iqr()","-sma()"])
                    and c.lower().startswith("t")]
    if len(reproducible) >= N_FEATURES:
        print(f"[train] Using {N_FEATURES} UCI time-domain feature columns")
        return df[reproducible[:N_FEATURES]].values.astype(float)
    print(f"[train] UCI cols not found, using first {N_FEATURES} numeric cols")
    return df[feature_cols[:N_FEATURES]].values.astype(float)


def _build_from_raw_sensor(df, activity_col):
    col_map = {c.lower(): c for c in df.columns}
    ax_raw = df[col_map["ax"]].values; ay_raw = df[col_map["ay"]].values; az_raw = df[col_map["az"]].values
    gx_raw = df[col_map["gx"]].values; gy_raw = df[col_map["gy"]].values; gz_raw = df[col_map["gz"]].values
    labels = df[activity_col].values

    # Auto-detect units: m/s2 (phone) vs g (UCI raw)
    if np.abs(az_raw).mean() > 5:
        print("[train] Detected m/s2 units ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â normalizing to g and rad/s")
        ax = ax_raw/_ACC_NORM; ay = ay_raw/_ACC_NORM; az = az_raw/_ACC_NORM
        gx = gx_raw/_GYRO_NORM; gy = gy_raw/_GYRO_NORM; gz = gz_raw/_GYRO_NORM
    else:
        print("[train] Detected g/rad/s units ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no normalization needed")
        ax = ax_raw; ay = ay_raw; az = az_raw
        gx = gx_raw; gy = gy_raw; gz = gz_raw

    n = len(ax)
    X_list, y_list = [], []
    for start in range(0, n - WINDOW_SIZE + 1, STEP_SIZE):
        end = start + WINDOW_SIZE
        feat = extract_features_from_arrays(ax[start:end], ay[start:end], az[start:end],
                                            gx[start:end], gy[start:end], gz[start:end])
        window_labels = labels[start:end]
        unique, counts = np.unique(window_labels, return_counts=True)
        X_list.append(feat)
        y_list.append(unique[np.argmax(counts)])

    print(f"[train] Built {len(X_list)} windows from {n} raw sensor rows")
    return np.vstack(X_list), np.array(y_list)


def run_training(filename: str, n_pca_components: int, n_clusters: int) -> dict:
    csv_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail=f"'{filename}' not found in /data.")

    df = pd.read_csv(csv_path)
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    activity_col, feature_cols = _detect_columns(df)

    if _is_raw_sensor_csv(df, feature_cols):
        print("[train] Detected raw phone sensor CSV ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â using windowed feature extraction")
        X_raw, y_raw = _build_from_raw_sensor(df, activity_col)
    else:
        print("[train] Detected pre-computed feature CSV ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â using UCI columns directly")
        X_raw = _select_uci_features(df, feature_cols)
        y_raw = df[activity_col].values
        if np.issubdtype(type(y_raw[0]), np.integer) or str(y_raw[0]).isdigit():
            y_raw = np.array([ACTIVITY_MAP.get(int(v), str(v)) for v in y_raw])

    print(f"[train] Dataset: {X_raw.shape}")
    print(f"[train] Activities: {dict(zip(*np.unique(y_raw, return_counts=True)))}")

    le = LabelEncoder()
    y  = le.fit_transform(y_raw)
    print(f"[train] Classes: {list(le.classes_)}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_raw, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler         = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Baseline model ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    print("[train] Fitting baseline RandomForest...")
    baseline = RandomForestClassifier(
        n_estimators=200, max_depth=15, min_samples_split=5,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    baseline.fit(X_train_scaled, y_train)
    baseline_acc = float(accuracy_score(y_test, baseline.predict(X_test_scaled)))
    print(f"[train] Baseline accuracy: {baseline_acc:.4f}")

    # ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ KMeans routing ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    print(f"[train] Fitting KMeans with {n_clusters} clusters...")
    kmeans         = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    train_clusters = kmeans.fit_predict(X_train_scaled)
    test_clusters  = kmeans.predict(X_test_scaled)

    cluster_distribution = {}
    routed_preds         = baseline.predict(X_test_scaled).copy()
    saved_models         = []

    for cid in range(n_clusters):
        train_mask = train_clusters == cid
        count      = int(train_mask.sum())
        cluster_distribution[str(cid)] = count

        if count < 20:
            print(f"[train] Cluster {cid}: only {count} samples ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â using baseline")
            continue

        unique_cls, cls_counts = np.unique(y_train[train_mask], return_counts=True)
        if len(unique_cls) < 2:
            print(f"[train] Cluster {cid}: single class ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â using baseline")
            continue

        clf = RandomForestClassifier(
            n_estimators=100, max_depth=10, min_samples_split=5,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        clf.fit(X_train_scaled[train_mask], y_train[train_mask])

        test_mask = test_clusters == cid
        if test_mask.sum() > 0:
            routed_preds[test_mask] = clf.predict(X_test_scaled[test_mask])

        joblib.dump(clf, os.path.join(MODELS_DIR, f"model_cluster_{cid}.pkl"))
        saved_models.append(f"model_cluster_{cid}.pkl")
        print(f"[train] Cluster {cid}: {count} samples ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â specialist model saved")

    routed_acc = float(accuracy_score(y_test, routed_preds))
    uplift     = round(routed_acc - baseline_acc, 4)
    print(f"[train] Baseline={baseline_acc:.4f}  Routed={routed_acc:.4f}  Uplift={uplift:+.4f}")
    print(classification_report(y_test, baseline.predict(X_test_scaled), target_names=le.classes_))

    # ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Save all models ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    joblib.dump(scaler,   os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(le,       os.path.join(MODELS_DIR, "label_encoder.pkl"))
    joblib.dump(baseline, os.path.join(MODELS_DIR, "model_baseline.pkl"))
    joblib.dump(kmeans,   os.path.join(MODELS_DIR, "kmeans.pkl"))
    saved_models += ["scaler.pkl", "label_encoder.pkl", "model_baseline.pkl", "kmeans.pkl"]

    # Save normalizer stub (keeps predict_service happy)
    joblib.dump({"feat_min": [], "feat_range": []}, os.path.join(MODELS_DIR, "feature_normalizer.pkl"))

    # Remove stale PCA
    p = os.path.join(MODELS_DIR, "pca.pkl")
    if os.path.exists(p): os.remove(p)

    metrics = {
        "timestamp":            datetime.now(timezone.utc).isoformat(),
        "baseline_accuracy":    round(baseline_acc, 4),
        "routed_accuracy":      round(routed_acc, 4),
        "accuracy_uplift":      uplift,
        "n_clusters":           n_clusters,
        "n_features":           N_FEATURES,
        "n_samples":            len(X_raw),
        "classes":              list(le.classes_),
        "cluster_distribution": cluster_distribution,
    }
    with open(METRICS_FILE, "w") as f:
        json.dump(metrics, f, indent=2)

    # Ã¢â€â‚¬Ã¢â€â‚¬ Save to PostgreSQL model registry Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    try:
        init_db()
        registry_entries = [
            {
                "cluster_id":    -1,  # -1 = baseline (global model)
                "model_version": f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                "accuracy":      round(baseline_acc, 4),
                "model_path":    "model_baseline.pkl",
                "n_samples":     len(X_train),
                "n_features":    N_FEATURES,
                "classes":       ",".join(le.classes_),
            }
        ]
        for cid in range(n_clusters):
            if os.path.exists(os.path.join(MODELS_DIR, f"model_cluster_{cid}.pkl")):
                registry_entries.append({
                    "cluster_id":    cid,
                    "model_version": f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
                    "accuracy":      None,
                    "model_path":    f"model_cluster_{cid}.pkl",
                    "n_samples":     int(cluster_distribution.get(str(cid), 0)),
                    "n_features":    N_FEATURES,
                    "classes":       ",".join(le.classes_),
                })
        save_model_registry(registry_entries)
        print(f"[train] Model registry saved to PostgreSQL ({len(registry_entries)} entries)")
    except Exception as e:
        print(f"[train] PostgreSQL registry save failed (non-fatal): {e}")

    return {
        "message":              "Training complete.",
        "n_clusters":           n_clusters,
        "n_pca_components":     0,
        "baseline_accuracy":    round(baseline_acc, 4),
        "routed_accuracy":      round(routed_acc, 4),
        "accuracy_uplift":      uplift,
        "cluster_distribution": cluster_distribution,
        "models_saved":         saved_models,
    }