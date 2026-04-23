"""upload.py - Dataset upload router."""

from fastapi import APIRouter, File, UploadFile, HTTPException
from schemas import APIResponse, UploadData
from services.upload_service import save_and_validate_csv, list_csv_files

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("", response_model=APIResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """Upload a CSV dataset. Saved to /data. Returns row/column count."""
    try:
        result = save_and_validate_csv(file)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    return APIResponse(data=UploadData(message="File uploaded successfully.", **result).dict())


@router.get("/files", response_model=APIResponse)
def list_files():
    """List all CSV files in /data."""
    return APIResponse(data={"files": list_csv_files()})
