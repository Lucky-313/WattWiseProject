from SciMetric import SCIMetric


class ExternalGridAdapter:
    # Adapts an external grid-intensity value to the SCIMetric interface.

    def apply_grid_intensity(
        self, metric: SCIMetric, grid_intensity: float
    ) -> None:
        # Set grid intensity on a metric so it can be used for SCI calculation.
        metric.grid_intensity = grid_intensity