import csv
import io
import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Protocol


class CSVImportError(ValueError):
    pass


class GridIntensityFetcher(Protocol):
    def fetch_daily_grid_intensity(
        self, start_date: date, end_date: date
    ) -> dict[date, float]: ...


@dataclass(frozen=True)
class OperationalRow:
    measured_on: date
    energy_kwh: float
    functional_unit_count: float
    grid_intensity: float | None
    carbon_emissions: float | None


@dataclass(frozen=True)
class PreparedDailyMetric:
    measured_on: date
    energy_kwh: float
    carbon_intensity_gco2_kwh: float
    functional_unit_count: float
    sci_score: float
    emissions_gco2e: float


def _parse_number(
    raw_value: str,
    field_name: str,
    row_number: int,
    *,
    minimum: float,
    strictly_greater: bool = False,
    optional: bool = False,
) -> float | None:
    if not raw_value.strip() and optional:
        return None
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise CSVImportError(
            f"Row {row_number}: '{field_name}' must be a number."
        ) from exc

    is_below_minimum = value <= minimum if strictly_greater else value < minimum
    if not math.isfinite(value) or is_below_minimum:
        operator = "greater than" if strictly_greater else "at least"
        raise CSVImportError(
            f"Row {row_number}: '{field_name}' must be {operator} {minimum:g}."
        )
    return value


def _parse_required_number(
    raw_value: str,
    field_name: str,
    row_number: int,
    *,
    minimum: float,
    strictly_greater: bool = False,
) -> float:
    value = _parse_number(
        raw_value,
        field_name,
        row_number,
        minimum=minimum,
        strictly_greater=strictly_greater,
    )
    if value is None:
        raise CSVImportError(f"Row {row_number}: '{field_name}' is required.")
    return value


def parse_operational_csv(content: str) -> list[OperationalRow]:
    reader = csv.reader(io.StringIO(content.lstrip("\ufeff")))
    try:
        header = next(reader, None)
        if not header:
            raise CSVImportError("The CSV needs a header row.")

        columns = [cell.strip().lower() for cell in header]
        if any(not column for column in columns):
            raise CSVImportError("The CSV header contains an empty column name.")
        if len(set(columns)) != len(columns):
            raise CSVImportError("The CSV contains duplicate column names.")

        required_columns = {"date", "energy_kwh", "functional_unit_count"}
        missing_columns = required_columns.difference(columns)
        if missing_columns:
            missing = ", ".join(sorted(missing_columns))
            raise CSVImportError(f"Missing required CSV column(s): {missing}.")

        rows: list[OperationalRow] = []
        for row_number, values in enumerate(reader, start=2):
            if not values or all(not value.strip() for value in values):
                continue
            if len(values) != len(columns):
                raise CSVImportError(
                    f"Row {row_number}: the number of values does not match the header."
                )
            raw = dict(zip(columns, values))
            date_text = raw["date"].strip()
            if len(date_text) != 10:
                raise CSVImportError(
                    f"Row {row_number}: 'date' must use YYYY-MM-DD format."
                )
            try:
                measured_on = date.fromisoformat(date_text)
            except ValueError as exc:
                raise CSVImportError(
                    f"Row {row_number}: '{date_text}' is not a valid date."
                ) from exc

            energy_kwh = _parse_required_number(
                raw["energy_kwh"], "energy_kwh", row_number, minimum=0
            )
            functional_unit_count = _parse_required_number(
                raw["functional_unit_count"],
                "functional_unit_count",
                row_number,
                minimum=0,
                strictly_greater=True,
            )
            grid_intensity = (
                _parse_number(
                    raw["grid_intensity"],
                    "grid_intensity",
                    row_number,
                    minimum=0,
                    optional=True,
                )
                if "grid_intensity" in raw
                else None
            )
            carbon_emissions = (
                _parse_number(
                    raw["carbon_emissions"],
                    "carbon_emissions",
                    row_number,
                    minimum=0,
                    optional=True,
                )
                if "carbon_emissions" in raw
                else None
            )
            rows.append(
                OperationalRow(
                    measured_on=measured_on,
                    energy_kwh=energy_kwh,
                    functional_unit_count=functional_unit_count,
                    grid_intensity=grid_intensity,
                    carbon_emissions=carbon_emissions,
                )
            )
    except csv.Error as exc:
        raise CSVImportError("The CSV file is not valid.") from exc

    if len(rows) not in {30, 31}:
        raise CSVImportError("The CSV must contain exactly 30 or 31 daily rows.")

    rows.sort(key=lambda row: row.measured_on)
    for previous, current in zip(rows, rows[1:]):
        if current.measured_on == previous.measured_on:
            raise CSVImportError(
                f"The CSV contains more than one row for {current.measured_on.isoformat()}."
            )
        if current.measured_on != previous.measured_on + timedelta(days=1):
            raise CSVImportError("CSV dates must be consecutive with no missing days.")
    return rows


def prepare_daily_metrics(
    content: str, grid_adapter: GridIntensityFetcher
) -> list[PreparedDailyMetric]:
    rows = parse_operational_csv(content)
    grid_intensities: dict[date, float] = {}
    if any(row.grid_intensity is None for row in rows):
        grid_intensities = grid_adapter.fetch_daily_grid_intensity(
            rows[0].measured_on, rows[-1].measured_on
        )

    prepared = []
    for row in rows:
        intensity = (
            row.grid_intensity
            if row.grid_intensity is not None
            else grid_intensities.get(row.measured_on)
        )
        if intensity is None:
            raise CSVImportError(
                f"No grid intensity is available for {row.measured_on.isoformat()}."
            )
        emissions = (
            row.carbon_emissions
            if row.carbon_emissions is not None
            else row.energy_kwh * intensity
        )
        prepared.append(
            PreparedDailyMetric(
                measured_on=row.measured_on,
                energy_kwh=row.energy_kwh,
                carbon_intensity_gco2_kwh=intensity,
                functional_unit_count=row.functional_unit_count,
                sci_score=emissions / row.functional_unit_count,
                emissions_gco2e=emissions,
            )
        )
    return prepared
