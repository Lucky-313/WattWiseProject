# backend/app/src/repositories/database.py

from database import get_measurement, store_sci_score


class MeasurementRepository:
    def get_measurement(self, service_id: int) -> dict[str, int | float | None] | None:
        return get_measurement(service_id)

    def store_sci_score(self, measurement_id: int, sci_score: float) -> bool:
        return store_sci_score(measurement_id, sci_score)
