from dataclasses import dataclass
from datetime import datetime


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