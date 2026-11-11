# backend/app/src/services/sci_service.py
from datetime import datetime
from ExternalGridAdapter import ExternalGridAdapter
from SciMetric import SCIMetric
from repositories.Database import MeasurementRepository

class SCIService:
    def __init__(self):
        self.grid_adapter = ExternalGridAdapter()
        self.repo = MeasurementRepository()

    async def process_sci_calculation(self, service_id: int) -> dict:
        # 1. Fetch raw data from data-layer safely
        measurement = self.repo.get_measurement(service_id)
        if not measurement:
            raise KeyError("No measurement found")

        # 2. Map and parse values
        try:
            energy_kwh = float(measurement["energy_used"])
            embodied_emissions = float(measurement["embodied_emissions"]) 
            functional_units = float(measurement["functional_unit"])
        except (TypeError, ValueError, KeyError):
            raise ValueError("Measurement contains invalid calculation data")

        # 3. Construct Domain Object
        metric = SCIMetric(
            metric_id=int(measurement["measurement_id"]),
            infra_id=int(measurement["infra_id"]),
            timestamp=datetime.now(),
            energy_consumed=energy_kwh,
            grid_intensity=0.0,
            embodied_emissions=embodied_emissions,
            functional_unit_count=functional_units,
            calculated_sci=0.0
        )
        
        # 4. Integrate with external tools and do the math
        intensity = self.grid_adapter.fetch_live_grid_intensity()
        self.grid_adapter.apply_grid_intensity(metric, intensity)
        sci_score = metric.calculate()

        # 5. Persist data back down to database
        self.repo.store_sci_score(measurement["measurement_id"], sci_score)

        return {"sci_score": sci_score, "carbon_intensity": intensity}
