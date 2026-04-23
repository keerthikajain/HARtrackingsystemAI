"""predict.py - Prediction router."""

from fastapi import APIRouter, HTTPException
from schemas import APIResponse, PredictRequest, PredictData
from services.predict_service import run_prediction
from services.logs_service import append_log

router = APIRouter(prefix="/predict", tags=["Predict"])


@router.post("", response_model=APIResponse)
def predict(request: PredictRequest):
    """Predict activity from a sliding window of sensor readings."""
    try:
        result = run_prediction(request.sensor_data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        append_log(
            predicted_activity=result["predicted_activity"],
            cluster=result["cluster"],
            probabilities=result["probabilities"],
        )
    except Exception:
        pass

    return APIResponse(data=PredictData(**result).dict())
