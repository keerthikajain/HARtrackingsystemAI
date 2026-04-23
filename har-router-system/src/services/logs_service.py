"""
logs_service.py - Prediction log helpers backed by PostgreSQL.
"""

from services.db_service import db_append_log, db_read_logs, db_clear_logs, db_count_logs


def append_log(predicted_activity: str, cluster: int, probabilities: dict):
    """Insert one prediction log entry into PostgreSQL."""
    db_append_log(predicted_activity, cluster, probabilities)


def read_logs(limit: int = None, activity_filter: str = None) -> list:
    """Read prediction logs from PostgreSQL, most recent first."""
    return db_read_logs(limit=limit or 500, activity_filter=activity_filter)


def clear_logs():
    """Delete all prediction logs from PostgreSQL."""
    db_clear_logs()


def count_logs() -> int:
    """Return total number of prediction log entries."""
    return db_count_logs()
