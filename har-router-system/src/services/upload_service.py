"""
upload_service.py - File handling logic for dataset uploads.
"""

import shutil
import pandas as pd
from fastapi import UploadFile, HTTPException
from pathlib import Path
from config import DATA_DIR


# ─────────────────────────────────────────────────────────────
# 🔹 Helpers
# ─────────────────────────────────────────────────────────────

def _sanitize_filename(filename: str) -> str:
    """Clean filename to avoid unsafe characters."""
    name = Path(filename).name  # removes any path traversal
    name = name.replace(" ", "_")
    return name


# ─────────────────────────────────────────────────────────────
# 🔹 Upload Logic
# ─────────────────────────────────────────────────────────────

def save_and_validate_csv(file: UploadFile) -> dict:
    """
    Save uploaded CSV to /data and return metadata.
    """

    # Validate extension
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed.")

    filename = _sanitize_filename(file.filename)
    save_path = DATA_DIR / filename

    # If file already exists, overwrite it (re-upload is intentional)
    # Save file
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Validate CSV
    try:
        df = pd.read_csv(save_path)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")

    if df.empty:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded CSV is empty.")

    return {
        "filename": filename,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
    }


# ─────────────────────────────────────────────────────────────
# 🔹 List Files
# ─────────────────────────────────────────────────────────────

def list_csv_files() -> list:
    """Return sorted list of CSV files."""
    return sorted([f.name for f in DATA_DIR.glob("*.csv")])
