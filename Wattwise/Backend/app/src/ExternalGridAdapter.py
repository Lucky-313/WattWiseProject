import json
import math
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

    def fetch_live_generation_mix(self) -> list[dict[str, float | str]]:
        url = f"{self.base_api_url}/generation"

        with urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))

        generation_mix = data["data"]["generationmix"]
        if not isinstance(generation_mix, list) or not generation_mix:
            raise ValueError("Grid generation mix is empty or invalid")

        validated_mix = []
        for item in generation_mix:
            if not isinstance(item, dict):
                raise ValueError("Grid generation mix contains an invalid entry")

            fuel = item.get("fuel")
            percentage = item.get("perc")
            if (
                not isinstance(fuel, str)
                or not fuel
                or isinstance(percentage, bool)
                or not isinstance(percentage, (int, float))
                or not math.isfinite(percentage)
                or percentage < 0
            ):
                raise ValueError("Grid generation mix contains an invalid entry")

            validated_mix.append({"fuel": fuel, "percentage": float(percentage)})

        return validated_mix


    def apply_grid_intensity(
        self, metric: SCIMetric, grid_intensity: float
    ) -> None:
        # Set grid intensity on a metric so it can be used for SCI calculation.
        metric.grid_intensity = grid_intensity
