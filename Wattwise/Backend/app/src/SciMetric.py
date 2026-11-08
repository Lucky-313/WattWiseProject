from dataclasses import dataclass
from datetime import datetime

from SciCalc import calculate_sci


# FastAPI can use standard dataclasses as response models and serialize datetime fields.
@dataclass
class SCIMetric:
    # Holds telemetry and the calculated SCI value for one infrastructure.
    # A dataclass represents the entity's data; calculation delegates to the
    # shared SCI function to keep the formula in one place.

    metric_id: int

    infra_id: int

    timestamp: datetime

    energy_consumed: float

    grid_intensity: float

    embodied_emissions: float

    functional_unit_count: float
    
    calculated_sci: float

    def calculate(self) -> float:
        # Calculate and store SCI from this metric's telemetry values.
        self.calculated_sci = calculate_sci(
            self.energy_consumed,
            self.grid_intensity,
            self.embodied_emissions,
            self.functional_unit_count,
        )
        return self.calculated_sci