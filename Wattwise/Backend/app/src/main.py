from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from SciMetric import SCIMetric
from ExternalGridAdapter import ExternalGridAdapter
from database import get_measurement, store_sci_score
from Auth import router as auth_router

grid_adapter = ExternalGridAdapter()
app = FastAPI()

# register auth routes
app.include_router(auth_router)

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

    # Create the SCI metric
    metric = SCIMetric(
        metric_id= int(measurement["measurement_id"]),
        infra_id= int(measurement["infra_id"]),
        timestamp= datetime.now(),
        energy_consumed= energy_kwh,
        grid_intensity= 0.0,
        embodied_emissions= embodied_emissions,
        functional_unit_count= functional_units,
        calculated_sci= 0.0
    )
    
    # Gets live grid intensity
    intensity = grid_adapter.fetch_live_grid_intensity()
    grid_adapter.apply_grid_intensity(metric, intensity)

    # calculates SCI score
    try:
        sci_score = metric.calculate()

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
        "sci_score": sci_score,
        "carbon_intensity": intensity
    }
        
