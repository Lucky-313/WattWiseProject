import json
import math
from datetime import date, datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from SciMetric import SCIMetric


class GridIntensityFetchError(RuntimeError):
    pass


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

    def fetch_daily_grid_intensity(
        self, start_date: date, end_date: date
    ) -> dict[date, float]:
        if end_date < start_date:
            raise ValueError("The end date must not be before the start date")

        daily_values: dict[date, list[float]] = {}
        chunk_start = start_date
        while chunk_start <= end_date:
            chunk_end = min(chunk_start + timedelta(days=13), end_date)
            from_time = f"{chunk_start.isoformat()}T00:00Z"
            to_time = f"{chunk_end.isoformat()}T23:59Z"
            url = f"{self.base_api_url}/intensity/{from_time}/{to_time}"
            try:
                with urlopen(url, timeout=10) as response:
                    payload = json.loads(response.read().decode("utf-8"))
            except HTTPError as exc:
                raise GridIntensityFetchError(
                    f"The GB Carbon Intensity API returned HTTP {exc.code}."
                ) from exc
            except (
                URLError,
                TimeoutError,
                OSError,
                UnicodeDecodeError,
                json.JSONDecodeError,
            ) as exc:
                raise GridIntensityFetchError(
                    "Could not retrieve historical GB grid intensity."
                ) from exc

            periods = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(periods, list):
                raise GridIntensityFetchError(
                    "The GB Carbon Intensity API returned an invalid response."
                )

            for period in periods:
                if not isinstance(period, dict):
                    raise GridIntensityFetchError(
                        "The GB Carbon Intensity API returned an invalid period."
                    )
                timestamp = period.get("from")
                intensity = period.get("intensity")
                if not isinstance(timestamp, str) or not isinstance(intensity, dict):
                    raise GridIntensityFetchError(
                        "The GB Carbon Intensity API returned an invalid period."
                    )
                try:
                    period_time = datetime.fromisoformat(
                        timestamp.replace("Z", "+00:00")
                    )
                    if period_time.tzinfo is None:
                        raise ValueError("The period timestamp has no timezone")
                    period_date = period_time.astimezone(timezone.utc).date()
                except ValueError as exc:
                    raise GridIntensityFetchError(
                        "The GB Carbon Intensity API returned an invalid timestamp."
                    ) from exc
                if not start_date <= period_date <= end_date:
                    continue

                value = intensity.get("actual")
                if value is None:
                    value = intensity.get("forecast")
                if value is None:
                    continue
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    or value < 0
                ):
                    raise GridIntensityFetchError(
                        "The GB Carbon Intensity API returned an invalid intensity."
                    )
                daily_values.setdefault(period_date, []).append(float(value))

            chunk_start = chunk_end + timedelta(days=1)

        if not daily_values:
            raise GridIntensityFetchError(
                "The GB Carbon Intensity API returned no data for the requested dates."
            )
        return {
            measured_on: sum(values) / len(values)
            for measured_on, values in daily_values.items()
        }

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
