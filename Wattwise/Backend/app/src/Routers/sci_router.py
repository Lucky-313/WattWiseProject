# backend/app/src/routers/sci.py
from fastapi import APIRouter, HTTPException
from Services.sci_service import SCIService

router = APIRouter()
sci_service = SCIService()

@router.get("/data")
def read_root():
    return {"message": "Hello from the FastAPI backend!"}

@router.get("/{service_id}")
async def calculate_sci(service_id: int):
    try:
        # Ask the service layer to do the operational work
        return await sci_service.process_sci_calculation(service_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error")
