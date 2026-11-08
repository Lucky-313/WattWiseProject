from SciMetric import SCIMetric


class DigitalInfrastructure:
    # Owns the collection of SCI metrics produced by this infrastructure.

    def __init__(self, infra_id: int) -> None:
        # Create the infrastructure entity and its initially empty metrics.
        self.infra_id = infra_id
        self.metrics: list[SCIMetric] = []

    def add_metric(self, metric: SCIMetric) -> None:
        # Attach a metric only when it belongs to this infrastructure.
        if metric.infra_id != self.infra_id:
            raise ValueError("SCI metric belongs to a different infrastructure")
        if metric in self.metrics:
            raise ValueError("SCI metric is already attached to this infrastructure")
        self.metrics.append(metric)
