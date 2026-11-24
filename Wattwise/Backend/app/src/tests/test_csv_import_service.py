import json
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from ExternalGridAdapter import ExternalGridAdapter
from Routers.dashboard_router import DashboardCreate, create_dashboard, save_csv
from Services.csv_import_service import (
    CSVImportError,
    parse_operational_csv,
    prepare_daily_metrics,
)
from database import Base, Dashboard, DashboardDailyMetric, DashboardImport
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


def make_csv(
    day_count: int = 30,
    *,
    header: str = "date,energy_kwh,functional_unit_count",
    row_values: list[str] | None = None,
) -> str:
    start = date(2025, 1, 1)
    lines = [header]
    for index in range(day_count):
        measured_on = start + timedelta(days=index)
        values = row_values[index] if row_values else "2,10"
        lines.append(f"{measured_on.isoformat()},{values}")
    return "\n".join(lines)


class FakeGridAdapter:
    def __init__(self, value: float = 100):
        self.value = value
        self.requested_range: tuple[date, date] | None = None

    def fetch_daily_grid_intensity(
        self, start_date: date, end_date: date
    ) -> dict[date, float]:
        self.requested_range = (start_date, end_date)
        intensities = {}
        current = start_date
        while current <= end_date:
            intensities[current] = self.value
            current += timedelta(days=1)
        return intensities


class FakeResponse:
    def __init__(self, payload: dict[str, object]):
        self.body = json.dumps(payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self) -> bytes:
        return self.body


class CSVImportServiceTests(unittest.TestCase):
    def test_builds_daily_sci_with_api_intensity_and_exact_date_range(self):
        adapter = FakeGridAdapter(150)

        measurements = prepare_daily_metrics(make_csv(), adapter)

        self.assertEqual(adapter.requested_range, (date(2025, 1, 1), date(2025, 1, 30)))
        self.assertEqual(len(measurements), 30)
        self.assertEqual(measurements[0].carbon_intensity_gco2_kwh, 150)
        self.assertEqual(measurements[0].emissions_gco2e, 300)
        self.assertEqual(measurements[0].sci_score, 30)

    def test_csv_values_override_api_and_direct_emissions(self):
        csv_content = make_csv(
            header=(
                "date,energy_kwh,functional_unit_count,"
                "carbon_emissions,grid_intensity"
            ),
            row_values=["2,10,500,200"] * 30,
        )
        adapter = FakeGridAdapter()

        measurements = prepare_daily_metrics(csv_content, adapter)

        self.assertIsNone(adapter.requested_range)
        self.assertEqual(measurements[0].carbon_intensity_gco2_kwh, 200)
        self.assertEqual(measurements[0].emissions_gco2e, 500)
        self.assertEqual(measurements[0].sci_score, 50)

    def test_requires_30_or_31_consecutive_unique_days(self):
        self.assertEqual(len(parse_operational_csv(make_csv(day_count=31))), 31)
        with self.assertRaisesRegex(CSVImportError, "exactly 30 or 31"):
            parse_operational_csv(make_csv(day_count=29))

        duplicate_date = make_csv().replace(
            "2025-01-02,2,10", "2025-01-01,2,10"
        )
        with self.assertRaisesRegex(CSVImportError, "more than one row"):
            parse_operational_csv(duplicate_date)

        missing_day = make_csv().replace(
            "2025-01-02,2,10", "2025-02-01,2,10"
        )
        with self.assertRaisesRegex(CSVImportError, "consecutive"):
            parse_operational_csv(missing_day)

    def test_rejects_nonpositive_functional_units(self):
        with self.assertRaisesRegex(CSVImportError, "functional_unit_count"):
            parse_operational_csv(
                make_csv(row_values=["2,0"] + ["2,10"] * 29)
            )

    def test_rejects_negative_energy(self):
        with self.assertRaisesRegex(CSVImportError, "energy_kwh"):
            parse_operational_csv(
                make_csv(row_values=["-1,10"] + ["2,10"] * 29)
            )

    def test_csv_dashboard_requires_a_file(self):
        with self.assertRaises(HTTPException) as error:
            create_dashboard(
                DashboardCreate(name="CSV dashboard", input_method="csv"),
                owner_id=1,
            )

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("Choose a CSV file", error.exception.detail)

    def test_fetches_half_hour_ranges_in_api_supported_chunks(self):
        requested_ranges = []

        def fake_urlopen(url: str, timeout: int):
            self.assertEqual(timeout, 10)
            path = url.split("/intensity/", 1)[1]
            start_text, end_text = path.split("/")
            start_date = date.fromisoformat(start_text[:10])
            end_date = date.fromisoformat(end_text[:10])
            requested_ranges.append((start_date, end_date))
            data = []
            current = start_date
            while current <= end_date:
                iso_date = current.isoformat()
                data.extend(
                    [
                        {
                            "from": f"{iso_date}T00:00Z",
                            "intensity": {"actual": 100, "forecast": 120},
                        },
                        {
                            "from": f"{iso_date}T00:30Z",
                            "intensity": {"actual": None, "forecast": 200},
                        },
                    ]
                )
                current += timedelta(days=1)
            return FakeResponse({"data": data})

        adapter = ExternalGridAdapter()
        with patch("ExternalGridAdapter.urlopen", side_effect=fake_urlopen) as request:
            daily = adapter.fetch_daily_grid_intensity(
                date(2025, 1, 1), date(2025, 1, 31)
            )

        self.assertEqual(request.call_count, 3)
        self.assertEqual(
            requested_ranges,
            [
                (date(2025, 1, 1), date(2025, 1, 14)),
                (date(2025, 1, 15), date(2025, 1, 28)),
                (date(2025, 1, 29), date(2025, 1, 31)),
            ],
        )
        self.assertEqual(len(daily), 31)
        self.assertEqual(daily[date(2025, 1, 1)], 150)
        self.assertEqual(daily[date(2025, 1, 31)], 150)

    def test_saves_csv_metrics_and_replaces_previous_import(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        csv_content = make_csv()
        prepared = (
            "new.csv",
            csv_content,
            prepare_daily_metrics(csv_content, FakeGridAdapter(150)),
        )

        with Session(engine) as session:
            dashboard = Dashboard(name="Test dashboard", owner_id=1)
            session.add(dashboard)
            session.flush()
            session.add(
                DashboardImport(
                    dashboard_id=dashboard.dashboard_id,
                    filename="old.csv",
                    content="old data",
                )
            )
            session.add(
                DashboardDailyMetric(
                    dashboard_id=dashboard.dashboard_id,
                    measured_on=date(2024, 12, 31),
                    energy_kwh=1,
                    carbon_intensity_gco2_kwh=100,
                    embodied_emissions_gco2e=0,
                    api_calls=1,
                    sci_score=100,
                    emissions_gco2e=100,
                )
            )
            session.commit()

            save_csv(session, dashboard, prepared)
            session.commit()

            metrics = (
                session.query(DashboardDailyMetric)
                .filter_by(dashboard_id=dashboard.dashboard_id)
                .order_by(DashboardDailyMetric.measured_on)
                .all()
            )
            imports = (
                session.query(DashboardImport)
                .filter_by(dashboard_id=dashboard.dashboard_id)
                .all()
            )
            session.refresh(dashboard)

            self.assertEqual(len(metrics), 30)
            self.assertEqual(metrics[0].measured_on, date(2025, 1, 1))
            self.assertEqual(metrics[0].api_calls, 10)
            self.assertEqual(metrics[0].emissions_gco2e, 300)
            self.assertEqual(len(imports), 1)
            self.assertEqual(imports[0].filename, "new.csv")
            self.assertEqual(dashboard.input_method, "csv")
            self.assertEqual(dashboard.sci_summary, 30)

        engine.dispose()


if __name__ == "__main__":
    unittest.main()
