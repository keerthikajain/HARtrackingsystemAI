"""
db_service.py - PostgreSQL for all persistent data.

Tables:
  users            — auth
  model_registry   — trained model metadata
  routing_log      — internal cluster routing stats
  prediction_logs  — every prediction result (replaces predictions.jsonl)
  feedback_logs    — user corrections (replaces feedback.jsonl)
"""

import os
import json
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone

DB_CONFIG = {
    "host":     os.getenv("PG_HOST",     "localhost"),
    "port":     int(os.getenv("PG_PORT", "5432")),
    "dbname":   os.getenv("PG_DB",       "har_router"),
    "user":     os.getenv("PG_USER",     "postgres"),
    "password": os.getenv("PG_PASSWORD", "12345"),
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


# ── Schema init ───────────────────────────────────────────────────────────────

def init_db():
    """Create all tables if they don't exist."""
    with get_conn() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            SERIAL PRIMARY KEY,
                    email         VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(64) NOT NULL,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_login    TIMESTAMPTZ
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS model_registry (
                    id                 SERIAL PRIMARY KEY,
                    cluster_id         INTEGER NOT NULL,
                    model_version      VARCHAR(50) NOT NULL,
                    training_timestamp TIMESTAMPTZ NOT NULL,
                    accuracy           FLOAT,
                    model_path         VARCHAR(255),
                    n_samples          INTEGER,
                    n_features         INTEGER,
                    classes            TEXT,
                    is_active          BOOLEAN DEFAULT TRUE
                );
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS routing_log (
                    id                 SERIAL PRIMARY KEY,
                    cluster_id         INTEGER NOT NULL,
                    predicted_activity VARCHAR(100) NOT NULL,
                    confidence         FLOAT NOT NULL,
                    timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Prediction logs — replaces predictions.jsonl
            cur.execute("""
                CREATE TABLE IF NOT EXISTS prediction_logs (
                    id                 SERIAL PRIMARY KEY,
                    predicted_activity VARCHAR(100) NOT NULL,
                    cluster            INTEGER NOT NULL DEFAULT 0,
                    probabilities      JSONB NOT NULL DEFAULT '{}',
                    timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Feedback logs — replaces feedback.jsonl
            cur.execute("""
                CREATE TABLE IF NOT EXISTS feedback_logs (
                    id                 SERIAL PRIMARY KEY,
                    predicted_activity VARCHAR(100) NOT NULL,
                    actual_activity    VARCHAR(100) NOT NULL,
                    sensor_data        JSONB NOT NULL DEFAULT '[]',
                    timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

            # Seed default admin user
            cur.execute("""
                INSERT INTO users (email, password_hash)
                VALUES (%s, %s)
                ON CONFLICT (email) DO NOTHING;
            """, ('admin@gmail.com', _hash_password('Har@2024')))

        conn.commit()
    print("[db] Tables initialised.")


# ── Prediction logs ───────────────────────────────────────────────────────────

def db_append_log(predicted_activity: str, cluster: int, probabilities: dict):
    """Insert one prediction into prediction_logs."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO prediction_logs (predicted_activity, cluster, probabilities, timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    predicted_activity,
                    cluster,
                    json.dumps(probabilities),
                    datetime.now(timezone.utc),
                ))
            conn.commit()
    except Exception as e:
        print(f"[db] append_log failed (non-fatal): {e}")


def db_read_logs(limit: int = 50, activity_filter: str = None) -> list:
    """Read prediction logs, most recent first."""
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if activity_filter:
                    cur.execute("""
                        SELECT predicted_activity, cluster, probabilities, timestamp
                        FROM prediction_logs
                        WHERE predicted_activity = %s
                        ORDER BY timestamp DESC
                        LIMIT %s
                    """, (activity_filter, limit))
                else:
                    cur.execute("""
                        SELECT predicted_activity, cluster, probabilities, timestamp
                        FROM prediction_logs
                        ORDER BY timestamp DESC
                        LIMIT %s
                    """, (limit,))
                rows = cur.fetchall()

        return [
            {
                "predicted_activity": r["predicted_activity"],
                "cluster":            r["cluster"],
                "probabilities":      r["probabilities"],
                "timestamp":          r["timestamp"].isoformat(),
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[db] read_logs failed: {e}")
        return []


def db_clear_logs():
    """Delete all prediction logs."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM prediction_logs")
            conn.commit()
    except Exception as e:
        print(f"[db] clear_logs failed: {e}")


def db_count_logs() -> int:
    """Return total number of prediction log entries."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM prediction_logs")
                return cur.fetchone()[0]
    except Exception as e:
        print(f"[db] count_logs failed: {e}")
        return 0


# ── Feedback logs ─────────────────────────────────────────────────────────────

def db_append_feedback(predicted_activity: str, actual_activity: str, sensor_data: list):
    """Insert one feedback entry into feedback_logs."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO feedback_logs (predicted_activity, actual_activity, sensor_data, timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (
                    predicted_activity,
                    actual_activity,
                    json.dumps(sensor_data),
                    datetime.now(timezone.utc),
                ))
            conn.commit()
    except Exception as e:
        print(f"[db] append_feedback failed: {e}")
        raise


def db_read_feedback(limit: int = 50) -> list:
    """Read feedback entries, most recent first."""
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT predicted_activity, actual_activity, sensor_data, timestamp
                    FROM feedback_logs
                    ORDER BY timestamp DESC
                    LIMIT %s
                """, (limit,))
                rows = cur.fetchall()

        return [
            {
                "predicted_activity": r["predicted_activity"],
                "actual_activity":    r["actual_activity"],
                "sensor_data":        r["sensor_data"],
                "timestamp":          r["timestamp"].isoformat(),
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[db] read_feedback failed: {e}")
        return []


def db_count_feedback() -> int:
    """Return total number of feedback entries."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM feedback_logs")
                return cur.fetchone()[0]
    except Exception as e:
        print(f"[db] count_feedback failed: {e}")
        return 0


# ── Model registry ────────────────────────────────────────────────────────────

def save_model_registry(entries: list):
    with get_conn() as conn:
        with conn.cursor() as cur:
            for e in entries:
                cur.execute(
                    "UPDATE model_registry SET is_active = FALSE WHERE cluster_id = %s",
                    (e["cluster_id"],)
                )
                cur.execute("""
                    INSERT INTO model_registry
                        (cluster_id, model_version, training_timestamp, accuracy,
                         model_path, n_samples, n_features, classes, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                """, (
                    e["cluster_id"],
                    e["model_version"],
                    datetime.now(timezone.utc),
                    e.get("accuracy"),
                    e.get("model_path"),
                    e.get("n_samples"),
                    e.get("n_features"),
                    e.get("classes"),
                ))
        conn.commit()
    print(f"[db] Saved {len(entries)} model registry entries.")


def get_model_registry() -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cluster_id, model_version, training_timestamp,
                       accuracy, model_path, n_samples, n_features, classes
                FROM model_registry
                WHERE is_active = TRUE
                ORDER BY cluster_id
            """)
            return [dict(r) for r in cur.fetchall()]


# ── Routing log ───────────────────────────────────────────────────────────────

def log_routing(cluster_id: int, predicted_activity: str, confidence: float):
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO routing_log (cluster_id, predicted_activity, confidence, timestamp)
                    VALUES (%s, %s, %s, %s)
                """, (cluster_id, predicted_activity, confidence, datetime.now(timezone.utc)))
            conn.commit()
    except Exception as e:
        print(f"[db] routing log failed (non-fatal): {e}")


def get_routing_stats() -> dict:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT cluster_id, COUNT(*) as count,
                       AVG(confidence) as avg_confidence,
                       MAX(timestamp) as last_used
                FROM routing_log
                GROUP BY cluster_id
                ORDER BY cluster_id
            """)
            rows = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT COUNT(*) as total FROM routing_log")
            total = cur.fetchone()["total"]
    return {"total_routings": total, "by_cluster": rows}


# ── User auth ─────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_user(email: str, password: str) -> dict | None:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, email, password_hash FROM users WHERE email = %s",
                    (email.strip().lower(),)
                )
                user = cur.fetchone()
                if not user or user["password_hash"] != _hash_password(password):
                    return None
                cur.execute(
                    "UPDATE users SET last_login = %s WHERE id = %s",
                    (datetime.now(timezone.utc), user["id"])
                )
            conn.commit()
        return {"id": user["id"], "email": user["email"]}
    except Exception as e:
        print(f"[db] verify_user error: {e}")
        return None


def create_user(email: str, password: str) -> dict | None:
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email",
                    (email.strip().lower(), _hash_password(password))
                )
                user = cur.fetchone()
            conn.commit()
        return dict(user)
    except psycopg2.errors.UniqueViolation:
        return None
    except Exception as e:
        print(f"[db] create_user error: {e}")
        return None


def get_all_users() -> list:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, email, created_at, last_login FROM users ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
