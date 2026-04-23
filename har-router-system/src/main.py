"""main.py - HAR Router FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from schemas import APIResponse
from upload import router as upload_router
from train import router as train_router
from predict import router as predict_router
from logs import router as logs_router
from analytics import router as analytics_router
from feedback import router as feedback_router
from collect import router as collect_router
from registry import router as registry_router
from auth import router as auth_router
from services.predict_service import registry
from services.db_service import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB tables and load models at startup."""
    try:
        init_db()
        print("[startup] Database initialised.")
    except Exception as e:
        print(f"[startup] DB init failed (non-fatal): {e}")
    try:
        registry.load()
        print("[startup] Models loaded successfully.")
    except Exception as e:
        print(f"[startup] Models not loaded yet: {e}")
    yield


app = FastAPI(
    title="HAR Router API",
    description="Human Activity Recognition – Intelligent Routing System",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS middleware (MUST be added before routers) ───────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # allow all origins (dev mode)
    allow_credentials=True,
    allow_methods=["*"],        # allows OPTIONS, POST, GET, etc.
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(train_router)
app.include_router(predict_router)
app.include_router(logs_router)
app.include_router(analytics_router)
app.include_router(feedback_router)
app.include_router(collect_router)
app.include_router(registry_router)
app.include_router(auth_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "success",
        "data": {
            "message": "HAR Router API is running.",
            "models_ready": registry.ready,
        }
    }
