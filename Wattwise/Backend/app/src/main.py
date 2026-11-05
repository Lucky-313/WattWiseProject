from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from SciCalc import calculate_sci
from database import get_measurement, store_sci_score

# hard coded carbon intensity
carbon_intensity= 129

app = FastAPI()

origins = [
    "http://localhost:5173", # Vite's default local address
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)

@app.get("/api/data")
def read_root():
    return {"message": "Hello from the FastAPI backend!"}


@app.get("/services/sci/{service_id}")
async def calculate_service_sci(service_id: int):

    # Get measurement data from database
    try:
        measurement = get_measurement(service_id)

    except Exception as exc:
        print("Database error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not read measurement data from the database"
        )

    if measurement is None:
        raise HTTPException(
            status_code=404,
            detail="No measurement found"
        )

    # Get values needed for SCI calculation
    try:
        energy_kwh = float(measurement["energy_used"])
        carbon_intensity = float(measurement["carbon_intensity"])
        embodied_emissions = float(measurement["embodied_emissions"])
        functional_units = float(measurement["functional_unit"])

    except (ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=422,
            detail="Measurement contains invalid calculation data"
        )

    # Calculate SCI score
    try:
        sci_score = calculate_sci(
            energy_kwh,
            carbon_intensity,
            embodied_emissions,
            functional_units
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc)
        )

    # Save SCI score to database
    try:
        store_sci_score(
            measurement["measurement_id"],
            sci_score
        )

    except Exception as exc:
        print("Save error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="SCI score could not be saved"
        )

    return {
        "sci_score": sci_score
    }