"""collect_service.py - Stores labeled sensor windows from the phone."""

import os
import csv
import numpy as np
from config import DATA_DIR

_COLLECTION_FILE = os.path.join(DATA_DIR, "_phone_collection.csv")
_FIELDNAMES = ["activity", "ax", "ay", "az", "gx", "gy", "gz"]

# In-memory buffer: list of (activity, [readings])
_buffer: list = []


def save_window(activity: str, sensor_data: list) -> dict:
    """Save each reading in the window with its activity label."""
    activity = activity.strip().upper().replace(" ", "_")
    for r in sensor_data:
        _buffer.append({
            "activity": activity,
            "ax": round(r.ax, 6), "ay": round(r.ay, 6), "az": round(r.az, 6),
            "gx": round(r.gx, 6), "gy": round(r.gy, 6), "gz": round(r.gz, 6),
        })

    stats = get_collection_stats()
    print(f"[collect] Saved {len(sensor_data)} readings for '{activity}' | total={len(_buffer)}")
    return {"activity": activity, "readings_added": len(sensor_data), "stats": stats}


def get_collection_stats() -> dict:
    from collections import Counter
    counts = Counter(r["activity"] for r in _buffer)
    return {
        "total_readings": len(_buffer),
        "per_activity": dict(counts),
        "ready_to_train": all(v >= 500 for v in counts.values()) and len(counts) >= 2,
    }


def export_csv(filename: str = "phone_data.csv") -> dict:
    if not _buffer:
        raise ValueError("No data collected yet.")

    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=_FIELDNAMES)
        writer.writeheader()
        writer.writerows(_buffer)

    stats = get_collection_stats()
    print(f"[collect] Exported {len(_buffer)} rows to {filename}")
    return {"filename": filename, "rows": len(_buffer), "stats": stats}


def clear_collection():
    _buffer.clear()
    print("[collect] Collection cleared")
