from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class DiagnosticLog:
    # Represents the result of evaluating one metric against an SLA.
    # Identifiers reference the related entities without making this record
    # responsible for owning them.

    sla_id: int
    dashboard_id: int
    metric_id: int
    target_metric: str
    observed_value: float
    max_threshold_limit: float
    breached: bool
    timestamp: datetime
    message: str

    def compile_report(self) -> dict[str, Any]:
        # Return a JSON-serializable summary of this diagnostic record.
        return {
            "sla_id": self.sla_id,
            "dashboard_id": self.dashboard_id,
            "metric_id": self.metric_id,
            "target_metric": self.target_metric,
            "observed_value": self.observed_value,
            "max_threshold_limit": self.max_threshold_limit,
            "breached": self.breached,
            "timestamp": self.timestamp.isoformat(),
            "message": self.message,
        }