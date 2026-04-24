"""
analytics_service.py - Analytics computation from logs and metrics.
"""

import json
from collections import Counter
from fastapi import HTTPException
from config import METRICS_FILE
from services.logs_service import read_logs


# ─────────────────────────────────────────────────────────────
# 🔹 Summary (from logs)
# ─────────────────────────────────────────────────────────────

def get_summary() -> dict:
    """Compute summary stats from logs."""

    entries = read_logs()

    if not entries:
        return {
            "total_predictions": 0,
            "activity_distribution": {},
            "cluster_distribution": {},
        }

    return {
        "total_predictions": len(entries),
        "activity_distribution": dict(
            Counter(e["predicted_activity"] for e in entries)
        ),
        "cluster_distribution": dict(
            Counter(str(e["cluster"]) for e in entries)
        ),
    }


# ─────────────────────────────────────────────────────────────
# 🔹 Accuracy (from metrics)
# ─────────────────────────────────────────────────────────────

def get_accuracy() -> dict:
    """Return baseline vs routed accuracy + F1 scores."""

    if not METRICS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="No training metrics found. Run /train first."
        )

    try:
        with METRICS_FILE.open() as f:
            m = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Metrics file is corrupted.")

    return {
        "baseline_accuracy":  m.get("baseline_accuracy", 0.0),
        "routed_accuracy":    m.get("routed_accuracy",   0.0),
        "accuracy_uplift":    m.get("accuracy_uplift",   0.0),
        "baseline_f1":        m.get("baseline", {}).get("f1", 0.0),
        "routed_f1":          m.get("routed",   {}).get("f1", 0.0),
        "baseline_precision": m.get("baseline", {}).get("precision", 0.0),
        "routed_precision":   m.get("routed",   {}).get("precision", 0.0),
        "baseline_recall":    m.get("baseline", {}).get("recall", 0.0),
        "routed_recall":      m.get("routed",   {}).get("recall", 0.0),
        "n_clusters":         m.get("n_clusters", 0),
        "n_cluster_models":   m.get("n_cluster_models", 0),
        "baseline_roc_auc":   m.get("baseline", {}).get("roc_auc", None),
        "routed_roc_auc":     m.get("routed",   {}).get("roc_auc", None),
        "silhouette_score":   m.get("silhouette_score", None),
    }


# ─────────────────────────────────────────────────────────────
# 🔹 Cluster Stats
# ─────────────────────────────────────────────────────────────

def get_cluster_stats() -> list:
    """Return cluster-wise sample counts from training + routing counts from prediction logs."""

    if not METRICS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="No training metrics found. Run /train first."
        )

    try:
        with METRICS_FILE.open() as f:
            m = json.load(f)
    except Exception:
        raise HTTPException(status_code=500, detail="Metrics file is corrupted.")

    cluster_dist    = m.get("cluster_distribution", {})
    cluster_metrics = m.get("cluster_metrics", {})

    # Count how many predictions were routed to each cluster from live logs
    entries = read_logs(limit=500)
    routing_counts = {}
    for e in entries:
        c = str(e.get("cluster", 0))
        routing_counts[c] = routing_counts.get(c, 0) + 1

    return [
        {
            "cluster_id":     int(k),
            "sample_count":   v,
            "routing_count":  routing_counts.get(k, 0),
            "cluster_accuracy": cluster_metrics.get(k, {}).get("accuracy", None),
        }
        for k, v in sorted(cluster_dist.items(), key=lambda x: int(x[0]))
    ]


# ─────────────────────────────────────────────────────────────
# 🔹 Logs for Dashboard Table
# ─────────────────────────────────────────────────────────────

def get_recent_logs(limit: int = 20) -> list:
    """Return recent logs for UI table."""
    return read_logs(limit=limit)


# ─────────────────────────────────────────────────────────────
# 🔹 Calorie Estimation
# ─────────────────────────────────────────────────────────────

# MET values per activity (Metabolic Equivalent of Task)
# Calories = MET × weight_kg × duration_hours
_MET = {
    "WALKING":            3.5,
    "WALKING_UPSTAIRS":   5.0,
    "WALKING_DOWNSTAIRS": 3.0,
    "SITTING":            1.3,
    "STANDING":           1.5,
    "LAYING":             1.0,
}
_DEFAULT_WEIGHT_KG = 70.0
_MAX_SEGMENT_MINUTES = 60  # cap any single segment at 60 min to prevent outliers


def calculate_calories(weight_kg: float = None) -> dict:
    """
    Calculate calories burned in the last 24 hours from prediction logs.

    Algorithm:
    1. Load all logs from the last 24 hours (sorted oldest → newest)
    2. Group consecutive predictions into activity segments
    3. Duration of each segment = time between its start and the next segment's start
       (last segment gets a fixed 4-second duration = one prediction interval)
    4. Calories = MET × weight_kg × duration_hours
    5. Cap each segment at MAX_SEGMENT_MINUTES to prevent outliers
    """
    from datetime import datetime, timezone, timedelta
    from dateutil import parser as dtparser

    weight = weight_kg if weight_kg and weight_kg > 0 else _DEFAULT_WEIGHT_KG

    entries = read_logs()  # most-recent first
    if not entries:
        return {
            "total_calories": 0.0,
            "weight_kg": weight,
            "by_activity": {},
            "segments": [],
            "hours_tracked": 0.0,
        }

    # Filter last 24 hours and reverse to chronological order
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)

    recent = []
    for e in entries:
        try:
            ts = dtparser.parse(e["timestamp"])
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts >= cutoff:
                recent.append((ts, e["predicted_activity"]))
        except Exception:
            continue

    recent.sort(key=lambda x: x[0])  # oldest first

    if not recent:
        return {
            "total_calories": 0.0,
            "weight_kg": weight,
            "by_activity": {},
            "segments": [],
            "hours_tracked": 0.0,
        }

    # Build activity segments: merge consecutive same-activity entries
    segments = []
    seg_start, seg_activity = recent[0]

    for i in range(1, len(recent)):
        ts, activity = recent[i]
        if activity != seg_activity:
            segments.append((seg_start, recent[i - 1][0], seg_activity))
            seg_start = ts
            seg_activity = activity

    # Last segment — duration = 4 seconds (one prediction interval)
    last_ts = recent[-1][0]
    segments.append((seg_start, last_ts + timedelta(seconds=4), seg_activity))

    # Calculate calories per segment
    by_activity: dict = {}
    segment_details = []
    total_calories = 0.0
    total_seconds = 0.0

    for start, end, activity in segments:
        duration_sec = (end - start).total_seconds()
        # Cap at max segment duration
        duration_sec = min(duration_sec, _MAX_SEGMENT_MINUTES * 60)
        duration_sec = max(duration_sec, 0)

        duration_hours = duration_sec / 3600.0
        met = _MET.get(activity, 1.5)
        cals = round(met * weight * duration_hours, 2)

        by_activity[activity] = round(by_activity.get(activity, 0.0) + cals, 2)
        total_calories += cals
        total_seconds += duration_sec

        segment_details.append({
            "activity":       activity,
            "start":          start.isoformat(),
            "end":            end.isoformat(),
            "duration_min":   round(duration_sec / 60, 1),
            "calories":       cals,
        })

    return {
        "total_calories":  round(total_calories, 1),
        "weight_kg":       weight,
        "by_activity":     by_activity,
        "segments":        segment_details,
        "hours_tracked":   round(total_seconds / 3600, 2),
    }
