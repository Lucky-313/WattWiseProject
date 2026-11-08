import json
from urllib.request import urlopen
from SciMetric import SCIMetric

class ExternalGridAdapter:

    def __init__(self):

        self.base_api_url = "https://api.carbonintensity.org.uk"
        self.api_token = None
        self.fallback_intensity = 129.0 # this value is from the average in 2025 

    def fetch_live_grid_intensity(self, region_zone="GB"):

        try:
            url = f"{self.base_api_url}/intensity"

            with urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))

            intensity = data["data"][0]["intensity"]["actual"]

            if intensity is None:
                intensity = data["data"][0]["intensity"]["forecast"]


            return float(intensity)

        except Exception:

            return self.fallback_intensity


    def apply_grid_intensity(
        self, metric: SCIMetric, grid_intensity: float
    ) -> None:
        # Set grid intensity on a metric so it can be used for SCI calculation.
        metric.grid_intensity = grid_intensity
