from dataclasses import fields
from datetime import datetime
from math import isfinite
from DiagnosticLog import DiagnosticLog
from SciMetric import SCIMetric


class SLARule:
    # Defines an SLA threshold associated with a specific dashboard.

    def __init__(
        self,
        sla_id: int,
        dashboard_id: int,
        target_metric: str,
        max_threshold_limit: float,
    ) -> None:
        # Store the rule's identity, owner, metric name, and upper limit.
        self.sla_id = sla_id
        self.dashboard_id = dashboard_id
        self.target_metric = target_metric
        self.max_threshold_limit = max_threshold_limit

    def evaluate_telemetry(self, metric: SCIMetric) -> DiagnosticLog:
        # Compare a numeric metric field with the limit and record the result.
        # Checking SCIMetric fields keeps the rule aligned with its input
        # contract; returning a log separates evaluation from logbook storage.
        metric_fields = {
            field.name
            for field in fields(SCIMetric)
            if field.name not in {"metric_id", "infra_id", "timestamp"}
        }
        if self.target_metric not in metric_fields:
            raise ValueError(
                f"Unknown SCIMetric target metric: {self.target_metric}"
            )

        observed_value = getattr(metric, self.target_metric)
        if isinstance(observed_value, bool) or not isinstance(
            observed_value, (int, float)
        ):
            raise ValueError(
                f"SCIMetric target {self.target_metric} must be numeric"
            )
        if not isfinite(observed_value) or not isfinite(self.max_threshold_limit):
            raise ValueError("Metric value and threshold must be finite numbers")

        breached = observed_value > self.max_threshold_limit
        message = (
            f"{self.target_metric} value {observed_value} "
            f"{'exceeds' if breached else 'does not exceed'} "
            f"the maximum threshold {self.max_threshold_limit}"
        )
        return DiagnosticLog(
            sla_id=self.sla_id,
            dashboard_id=self.dashboard_id,
            metric_id=metric.metric_id,
            target_metric=self.target_metric,
            observed_value=float(observed_value),
            max_threshold_limit=self.max_threshold_limit,
            breached=breached,
            timestamp=metric.timestamp,
            message=message,
        )