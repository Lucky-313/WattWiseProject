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
async def calculate_sci(service_id):

    # tries to get measurement data from database
    try:
        measurement = get_measurement(service_id)

    except Exception:
        raise HTTPException(
            status_code=500, detail="Could not read measurement data from the database")

    if measurement is None:
        raise HTTPException(
            status_code=404, detail="No measurement found")

    # tries to take needed data for sci cal from measurement

    try:
        energy_kwh = float(measurement["energy_used"])
        embodied_emissions = float(measurement["embodied_emissions"]) 
        functional_units = float(measurement["functional_unit"])

    except ValueError:
        raise HTTPException(
            status_code=422, detail="Measurement contains invalid calculation data")

    # calculates SCI score

    try:
        sci_score = calculate_sci(energy_kwh, carbon_intensity, embodied_emissions, functional_units)

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # send SCI score to database

    try:

        store_sci_score(
            measurement["measurement_id"], sci_score
        )

    except Exception:
        raise HTTPException(
            status_code=500, detail="SCI score could not be saved")

    # semds data to frontend
    return{
        "sci_score": sci_score}
        
