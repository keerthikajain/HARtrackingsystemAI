"""auth.py - User authentication endpoints backed by PostgreSQL."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from schemas import APIResponse
from services.db_service import verify_user, create_user, get_all_users, init_db

router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email:    str = Field(..., description="User email")
    password: str = Field(..., description="User password")


@router.post("/login", response_model=APIResponse)
def login(req: LoginRequest):
    """
    Sign in or auto-register.
    - If email exists: verify password and sign in.
    - If email is new: create account and sign in immediately.
    Credentials are stored in PostgreSQL users table.
    """
    try:
        init_db()
        # Try to verify existing user first
        user = verify_user(req.email, req.password)
        if user:
            return APIResponse(data={"user": {"id": user["id"], "email": user["email"]}, "action": "login"})

        # Check if email exists with wrong password
        from services.db_service import get_conn
        from psycopg2.extras import RealDictCursor
        with get_conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id FROM users WHERE email = %s", (req.email.strip().lower(),))
                existing = cur.fetchone()

        if existing:
            # Email exists but password wrong
            raise HTTPException(status_code=401, detail="Invalid credentials. Password does not meet the required criteria.")

        # New user — create and sign in
        user = create_user(req.email, req.password)
        if not user:
            raise HTTPException(status_code=500, detail="Could not create account.")

        return APIResponse(data={"user": {"id": user["id"], "email": user["email"]}, "action": "registered"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")


@router.post("/register", response_model=APIResponse)
def register(req: LoginRequest):
    """Create a new user in PostgreSQL."""
    try:
        init_db()
        user = create_user(req.email, req.password)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

    if not user:
        raise HTTPException(status_code=409, detail="Email already registered.")

    return APIResponse(data={"user": {"id": user["id"], "email": user["email"]}})


@router.get("/users", response_model=APIResponse)
def list_users():
    """List all registered users (admin use)."""
    try:
        users = get_all_users()
        for u in users:
            if u.get("created_at"): u["created_at"] = str(u["created_at"])
            if u.get("last_login"):  u["last_login"]  = str(u["last_login"])
        return APIResponse(data={"users": users, "total": len(users)})
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
