from SciMetric import SCIMetric


class DigitalInfrastructure:
    # Owns the collection of SCI metrics produced by this infrastructure.

    def __init__(
        self,
        infra_id: int,
        name: str = "",
        functional_unit_type: str = "",
    ) -> None:
        self.infra_id = infra_id
        self.name = name
        self.functional_unit_type = functional_unit_type
        self.historical_metrics: list[SCIMetric] = []

    @property
    def metrics(self) -> list[SCIMetric]:
        # Preserve the existing public attribute name.
        return self.historical_metrics

    def record_metric(self, metric: SCIMetric) -> None:
        if metric.infra_id != self.infra_id:
            raise ValueError("SCI metric belongs to a different infrastructure")
        if metric in self.historical_metrics:
            raise ValueError("SCI metric is already attached to this infrastructure")
        self.historical_metrics.append(metric)

    def get_latest_metric(self) -> SCIMetric:
        if not self.historical_metrics:
            raise ValueError("No metrics have been recorded for this infrastructure")
        return self.historical_metrics[-1]

    def add_metric(self, metric: SCIMetric) -> None:
        self.record_metric(metric)
