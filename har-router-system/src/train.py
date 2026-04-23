"""train.py - Model training router."""

from fastapi import APIRouter, HTTPException
from schemas import APIResponse, TrainRequest, TrainData
from services.train_service import run_training
from services.predict_service import registry

router = APIRouter(prefix="/train", tags=["Train"])


@router.post("", response_model=APIResponse)
def train_models(req: TrainRequest):
    """Train the full HAR Router pipeline. Reloads models after training."""
    try:
        result = run_training(req.filename, req.n_pca_components, req.n_clusters)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    try:
        registry.reload()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training succeeded but model reload failed: {e}")

    return APIResponse(data=TrainData(**result).model_dump())
