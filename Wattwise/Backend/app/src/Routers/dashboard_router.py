import csv
import io
import json
from datetime import date, datetime, timezone
from pathlib import PurePath
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ExternalGridAdapter import ExternalGridAdapter
from DiagnosticLog import DiagnosticLog
from LogBook import Logbook as DashboardLogbook
from Security import (
    create_dashboard_access_token,
    hash_password,
    verify_access_token,
    verify_dashboard_access_token,
    verify_password,
)
from database import (
    Dashboard,
    DashboardDailyMetric,
    DashboardImport,
    Logbook,
    Report,
    Session as DatabaseSession,
    SLA_Log,
    SLA_Rule,
    engine,
)

router = APIRouter(prefix="/api", tags=["Workspace"])
bearer_scheme = HTTPBearer(auto_error=False)
MAX_CSV_BYTES = 5 * 1024 * 1024
METRIC_DETAILS = {
    "sci": ("Software carbon intensity", "gCO₂e / API call"),
    "emissions": ("Carbon emissions", "kgCO₂e / day"),
    "intensity": ("Grid carbon intensity", "gCO₂e / kWh"),
    "energy": ("Energy consumption", "kWh / day"),
    "embodied_emissions": ("Embodied emissions", "gCO₂e / day"),
    "api_calls": ("API calls", "calls / day"),
}


class DashboardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    protect_with_passcode: bool = False
    passcode: str | None = Field(default=None, min_length=4, max_length=128)
    input_method: Literal["manual", "csv"] = "manual"
    csv_filename: str | None = Field(default=None, max_length=255)
    csv_content: str | None = None


class PasscodeVerification(BaseModel):
    passcode: str = Field(min_length=1, max_length=128)


class DashboardSettings(BaseModel):
    current_passcode: str | None = Field(default=None, max_length=128)
    new_passcode: str | None = Field(default=None, min_length=4, max_length=128)
    remove_passcode: bool = False


class DashboardDelete(BaseModel):
    passcode: str | None = Field(default=None, max_length=128)


class DailyMetricInput(BaseModel):
    measured_on: date
    energy_kwh: float = Field(ge=0)
    carbon_intensity_gco2_kwh: float = Field(ge=0)
    embodied_emissions_gco2e: float = Field(ge=0)
    api_calls: float = Field(gt=0)


class DashboardMetricSync(BaseModel):
    measurements: list[DailyMetricInput] = Field(min_length=1, max_length=366)


class SLARuleInput(BaseModel):
    target_metric: Literal[
        "sci", "emissions", "intensity", "energy", "embodied_emissions", "api_calls"
    ]
    max_threshold_limit: float = Field(ge=0)


def metric_value(metric_key: str, measurement: DashboardDailyMetric) -> float:
    if metric_key == "sci":
        return measurement.sci_score
    if metric_key == "emissions":
        return measurement.emissions_gco2e / 1000
    if metric_key == "intensity":
        return measurement.carbon_intensity_gco2_kwh
    if metric_key == "energy":
        return measurement.energy_kwh
    if metric_key == "embodied_emissions":
        return measurement.embodied_emissions_gco2e
    if metric_key == "api_calls":
        return measurement.api_calls
    raise ValueError(f"Unsupported SLA metric: {metric_key}")


def details_date(details: dict[str, object]) -> str | None:
    value = details.get("report_date") or details.get("observed_date")
    if isinstance(value, str):
        return value[:10]
    return None


def report_breaches(details: dict[str, object]) -> list[dict[str, object]]:
    breaches = details.get("breaches")
    if isinstance(breaches, list):
        return [item for item in breaches if isinstance(item, dict)]
    if details.get("target_metric") or details.get("metric_key"):
        return [details]
    return []


def consolidate_daily_reports(session: Session, dashboard_id: int) -> None:
    reports = (
        session.query(Report)
        .filter(
            Report.dashboard_id == dashboard_id,
            Report.report_type == "SLA breach",
        )
        .order_by(Report.generated_at.asc(), Report.report_id.asc())
        .all()
    )
    grouped: dict[str, list[tuple[Report, dict[str, object]]]] = {}
    for report in reports:
        try:
            details = json.loads(report.content or "{}")
        except json.JSONDecodeError:
            continue
        if not isinstance(details, dict):
            continue
        report_date = details_date(details)
        if report_date:
            grouped.setdefault(report_date, []).append((report, details))

    for report_date, dated_reports in grouped.items():
        primary, base_details = dated_reports[0]
        breaches_by_key: dict[str, dict[str, object]] = {}
        for _, details in dated_reports:
            for breach in report_breaches(details):
                metric_key = str(
                    breach.get("target_metric") or breach.get("metric_key") or ""
                )
                unique_key = metric_key or str(breach.get("sla_id") or "")
                breaches_by_key[unique_key] = breach

        if not breaches_by_key:
            for duplicate, _ in dated_reports[1:]:
                session.delete(duplicate)
            continue

        content = {
            **base_details,
            "report_date": report_date,
            "observed_date": report_date,
            "message": f"{len(breaches_by_key)} metric limit(s) exceeded on {report_date}",
            "breaches": list(breaches_by_key.values()),
        }
        primary.report_name = f"Sustainability breaches · {report_date}"
        primary.content = json.dumps(content)
        for duplicate, _ in dated_reports[1:]:
            session.delete(duplicate)


def evaluate_sla_rules(session: Session, dashboard_id: int) -> int:
    rules = (
        session.query(SLA_Rule)
        .filter(
            SLA_Rule.dashboard_id == dashboard_id,
            SLA_Rule.is_active.is_(True),
        )
        .order_by(SLA_Rule.sla_id.asc())
        .all()
    )
    measurements = (
        session.query(DashboardDailyMetric)
        .filter(DashboardDailyMetric.dashboard_id == dashboard_id)
        .order_by(DashboardDailyMetric.measured_on.asc())
        .all()
    )
    registered_logs = DashboardLogbook(dashboard_id)
    reports_before = (
        session.query(Report.report_id, Report.content)
        .filter(
            Report.dashboard_id == dashboard_id,
            Report.report_type == "SLA breach",
        )
        .all()
    )
    dates_before: set[str | None] = set()
    for _, content in reports_before:
        try:
            details = json.loads(content or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(details, dict):
            dates_before.add(details_date(details))

    for rule in rules:
        metric_key = rule.target_metric
        if metric_key not in METRIC_DETAILS:
            continue
        metric_label, unit = METRIC_DETAILS[metric_key]
        for measurement in measurements:
            observed = metric_value(metric_key, measurement)
            if observed <= rule.max_threshold_limit:
                continue
            source_date = measurement.measured_on.isoformat()
            existing = (
                session.query(SLA_Log.log_id)
                .filter(
                    SLA_Log.sla_id == rule.sla_id,
                    SLA_Log.source_date == source_date,
                )
                .first()
            )
            if existing:
                continue

            difference = observed - rule.max_threshold_limit
            percentage_over = (
                difference / rule.max_threshold_limit * 100
                if rule.max_threshold_limit > 0
                else None
            )
            message = (
                f"{metric_label} exceeded its limit on {source_date}"
            )
            diagnostic = DiagnosticLog(
                sla_id=rule.sla_id,
                dashboard_id=dashboard_id,
                metric_id=measurement.metric_id,
                target_metric=metric_key,
                observed_value=observed,
                max_threshold_limit=rule.max_threshold_limit,
                breached=True,
                timestamp=datetime.now(timezone.utc),
                message=message,
            )
            registered_logs.register_exception(diagnostic)
            log = SLA_Log(
                sla_id=rule.sla_id,
                source_date=source_date,
                metric_key=metric_key,
                observed_value=observed,
                max_threshold_limit=rule.max_threshold_limit,
                peak_value=observed,
                percentage_difference=percentage_over,
                message=message,
            )
            session.add(log)
            session.flush()

            content = diagnostic.compile_report()
            report_date = source_date
            content.update(
                {
                    "log_id": log.log_id,
                    "metric_key": metric_key,
                    "metric_label": metric_label,
                    "unit": unit,
                    "report_date": report_date,
                    "observed_date": source_date,
                    "difference": difference,
                    "percentage_over": percentage_over,
                    "sci_score": measurement.sci_score,
                    "emissions_kgco2e": measurement.emissions_gco2e / 1000,
                    "energy_kwh": measurement.energy_kwh,
                    "carbon_intensity_gco2_kwh": measurement.carbon_intensity_gco2_kwh,
                    "embodied_emissions_gco2e": measurement.embodied_emissions_gco2e,
                    "api_calls": measurement.api_calls,
                }
            )
            existing_report = None
            for candidate in (
                session.query(Report)
                .filter(
                    Report.dashboard_id == dashboard_id,
                    Report.report_type == "SLA breach",
                )
                .order_by(Report.report_id.asc())
                .all()
            ):
                try:
                    candidate_details = json.loads(candidate.content or "{}")
                except json.JSONDecodeError:
                    continue
                if isinstance(candidate_details, dict) and details_date(candidate_details) == report_date:
                    existing_report = candidate
                    break

            if existing_report is None:
                report_content = {
                    **content,
                    "message": f"{metric_label} exceeded its limit on {source_date}",
                    "breaches": [content],
                }
                session.add(
                    Report(
                        dashboard_id=dashboard_id,
                        report_name=f"Sustainability breaches · {source_date}",
                        report_type="SLA breach",
                        content=json.dumps(report_content),
                    )
                )
            else:
                report_content = json.loads(existing_report.content or "{}")
                breaches = report_breaches(report_content)
                if not any(
                    str(item.get("target_metric") or item.get("metric_key")) == metric_key
                    for item in breaches
                ):
                    breaches.append(content)
                report_content.update(
                    {
                        "report_date": report_date,
                        "observed_date": report_date,
                        "message": f"{len(breaches)} metric limit(s) exceeded on {report_date}",
                        "breaches": breaches,
                    }
                )
                existing_report.report_name = (
                    f"Sustainability breaches · {source_date}"
                )
                existing_report.content = json.dumps(report_content)

    consolidate_daily_reports(session, dashboard_id)
    reports_after = (
        session.query(Report.report_id, Report.content)
        .filter(
            Report.dashboard_id == dashboard_id,
            Report.report_type == "SLA breach",
        )
        .all()
    )
    dates_after: set[str | None] = set()
    for _, content in reports_after:
        try:
            details = json.loads(content or "{}")
        except json.JSONDecodeError:
            continue
        if isinstance(details, dict):
            dates_after.add(details_date(details))
    return len(dates_after - dates_before)


def authenticated_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> int:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to access your workspace",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = verify_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def dashboard_response(
    dashboard: Dashboard, imported_file: DashboardImport | None = None
) -> dict[str, object]:
    return {
        "dashboard_id": dashboard.dashboard_id,
        "name": dashboard.name,
        "is_locked": dashboard.passcode_hash is not None,
        "input_method": dashboard.input_method,
        "sci_summary": dashboard.sci_summary,
        "has_csv": imported_file is not None,
        "csv_filename": imported_file.filename if imported_file else None,
        "created_at": (
            dashboard.created_at.isoformat() if dashboard.created_at else None
        ),
    }


def get_owned_dashboard(
    session: Session, dashboard_id: int, owner_id: int
) -> Dashboard:
    dashboard = (
        session.query(Dashboard)
        .filter(
            Dashboard.dashboard_id == dashboard_id,
            Dashboard.owner_id == owner_id,
        )
        .first()
    )
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


def require_dashboard_access(
    dashboard: Dashboard, user_id: int, access_token: str | None
) -> None:
    if dashboard.passcode_hash is None:
        return
    if access_token and verify_dashboard_access_token(
        access_token, user_id, dashboard.dashboard_id
    ):
        return
    raise HTTPException(
        status_code=403,
        detail="Unlock this dashboard before accessing its data",
    )


def validate_csv(filename: str, content: str) -> tuple[str, str]:
    safe_filename = PurePath(filename).name
    if not safe_filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Choose a CSV file")
    if not content.strip():
        raise HTTPException(status_code=422, detail="The CSV file is empty")
    if len(content.encode("utf-8")) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="CSV files must be 5 MB or smaller")

    try:
        rows = csv.reader(io.StringIO(content))
        header = next(rows, None)
        first_record = next(rows, None)
    except csv.Error as exc:
        raise HTTPException(status_code=422, detail="The CSV file is not valid") from exc

    if not header or not any(cell.strip() for cell in header):
        raise HTTPException(status_code=422, detail="The CSV needs a header row")
    if first_record is None:
        raise HTTPException(
            status_code=422, detail="The CSV needs at least one data row"
        )
    return safe_filename[:255], content


def save_csv(
    session: Session, dashboard: Dashboard, filename: str, content: str
) -> DashboardImport:
    safe_filename, csv_content = validate_csv(filename, content)
    session.query(DashboardImport).filter(
        DashboardImport.dashboard_id == dashboard.dashboard_id
    ).delete()
    imported_file = DashboardImport(
        dashboard_id=dashboard.dashboard_id,
        filename=safe_filename,
        content=csv_content,
    )
    dashboard.input_method = "csv"
    session.add(imported_file)
    return imported_file


@router.get("/telemetry")
def read_telemetry(_: int = Depends(authenticated_user_id)) -> dict[str, object]:
    intensity = ExternalGridAdapter().fetch_live_grid_intensity()
    return {
        "region": "GB",
        "carbon_intensity_gco2_kwh": intensity,
        "ambient_temperature_c": None,
        "source": "UK Carbon Intensity API",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/dashboards")
def list_dashboards(
    owner_id: int = Depends(authenticated_user_id),
) -> list[dict[str, object]]:
    with DatabaseSession(engine) as session:
        dashboards = (
            session.query(Dashboard)
            .filter(Dashboard.owner_id == owner_id)
            .order_by(Dashboard.dashboard_id.asc())
            .all()
        )
        results = []
        for dashboard in dashboards:
            imported_file = (
                session.query(DashboardImport)
                .filter(DashboardImport.dashboard_id == dashboard.dashboard_id)
                .order_by(DashboardImport.created_at.desc())
                .first()
            )
            results.append(dashboard_response(dashboard, imported_file))
        return results


@router.post("/dashboards", status_code=status.HTTP_201_CREATED)
def create_dashboard(
    request: DashboardCreate,
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Dashboard name is required")
    if request.protect_with_passcode and not request.passcode:
        raise HTTPException(
            status_code=422,
            detail="Enter a passcode or turn off passcode protection",
        )
    if request.csv_content is not None and not request.csv_filename:
        raise HTTPException(status_code=422, detail="CSV filename is required")

    with DatabaseSession(engine) as session:
        count = (
            session.query(Dashboard)
            .filter(Dashboard.owner_id == owner_id)
            .count()
        )
        if count >= 3:
            raise HTTPException(
                status_code=409, detail="You can create up to 3 dashboards"
            )

        dashboard = Dashboard(
            name=name,
            owner_id=owner_id,
            is_demo=False,
            passcode_hash=(
                hash_password(request.passcode)
                if request.protect_with_passcode and request.passcode
                else None
            ),
            input_method=request.input_method,
        )
        session.add(dashboard)
        session.flush()
        imported_file = None
        if request.csv_content is not None and request.csv_filename:
            imported_file = save_csv(
                session, dashboard, request.csv_filename, request.csv_content
            )
        session.commit()
        session.refresh(dashboard)
        if imported_file:
            session.refresh(imported_file)
        response = dashboard_response(dashboard, imported_file)
        if dashboard.passcode_hash:
            response["dashboard_access_token"] = create_dashboard_access_token(
                owner_id, dashboard.dashboard_id
            )
        return response


@router.get("/dashboards/{dashboard_id}")
def read_dashboard(
    dashboard_id: int,
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        imported_file = (
            session.query(DashboardImport)
            .filter(DashboardImport.dashboard_id == dashboard_id)
            .order_by(DashboardImport.created_at.desc())
            .first()
        )
        return dashboard_response(dashboard, imported_file)


@router.post("/dashboards/{dashboard_id}/verify-passcode")
def verify_dashboard_passcode(
    dashboard_id: int,
    request: PasscodeVerification,
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        if dashboard.passcode_hash is None:
            return {"verified": True, "dashboard_access_token": None}
        if not verify_password(request.passcode, dashboard.passcode_hash):
            raise HTTPException(status_code=403, detail="Incorrect passcode")
        return {
            "verified": True,
            "dashboard_access_token": create_dashboard_access_token(
                owner_id, dashboard.dashboard_id
            ),
        }


@router.patch("/dashboards/{dashboard_id}/settings")
def update_dashboard_settings(
    dashboard_id: int,
    request: DashboardSettings,
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        if dashboard.passcode_hash and not request.current_passcode:
            raise HTTPException(
                status_code=422, detail="Enter the current passcode first"
            )
        if dashboard.passcode_hash and request.current_passcode:
            if not verify_password(
                request.current_passcode, dashboard.passcode_hash
            ):
                raise HTTPException(status_code=403, detail="Incorrect passcode")

        if request.remove_passcode:
            dashboard.passcode_hash = None
        elif request.new_passcode:
            dashboard.passcode_hash = hash_password(request.new_passcode)

        session.commit()
        session.refresh(dashboard)
        imported_file = (
            session.query(DashboardImport)
            .filter(DashboardImport.dashboard_id == dashboard_id)
            .order_by(DashboardImport.created_at.desc())
            .first()
        )
        return dashboard_response(dashboard, imported_file)


@router.get("/dashboards/{dashboard_id}/logbook")
def read_dashboard_logbook(
    dashboard_id: int,
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        measurements = (
            session.query(DashboardDailyMetric)
            .filter(DashboardDailyMetric.dashboard_id == dashboard_id)
            .order_by(DashboardDailyMetric.measured_on.asc())
            .all()
        )
        rules = (
            session.query(SLA_Rule)
            .filter(
                SLA_Rule.dashboard_id == dashboard_id,
                SLA_Rule.is_active.is_(True),
            )
            .order_by(SLA_Rule.sla_id.asc())
            .all()
        )
        consolidate_daily_reports(session, dashboard_id)
        session.commit()
        reports = (
            session.query(Report)
            .filter(
                Report.dashboard_id == dashboard_id,
                Report.report_type == "SLA breach",
            )
            .order_by(Report.generated_at.desc(), Report.report_id.desc())
            .all()
        )
        return {
            "dashboard_id": dashboard_id,
            "dashboard_name": dashboard.name,
            "measurement_days": len(measurements),
            "rules": [
                {
                    "sla_id": rule.sla_id,
                    "target_metric": rule.target_metric,
                    "metric_label": METRIC_DETAILS.get(
                        rule.target_metric, (rule.target_metric, "")
                    )[0],
                    "unit": METRIC_DETAILS.get(rule.target_metric, ("", ""))[1],
                    "max_threshold_limit": rule.max_threshold_limit,
                }
                for rule in rules
            ],
            "reports": [
                {
                    "report_id": report.report_id,
                    "report_name": report.report_name,
                    "generated_at": (
                        report.generated_at.isoformat()
                        if report.generated_at
                        else None
                    ),
                    "details": json.loads(report.content or "{}"),
                }
                for report in reports
            ],
        }


@router.put("/dashboards/{dashboard_id}/measurements")
def sync_dashboard_measurements(
    dashboard_id: int,
    request: DashboardMetricSync,
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, int]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        for item in request.measurements:
            sci_score = (
                item.energy_kwh * item.carbon_intensity_gco2_kwh
                + item.embodied_emissions_gco2e
            ) / item.api_calls
            emissions = (
                item.energy_kwh * item.carbon_intensity_gco2_kwh
                + item.embodied_emissions_gco2e
            )
            measurement = (
                session.query(DashboardDailyMetric)
                .filter(
                    DashboardDailyMetric.dashboard_id == dashboard_id,
                    DashboardDailyMetric.measured_on == item.measured_on,
                )
                .first()
            )
            if measurement is None:
                measurement = DashboardDailyMetric(
                    dashboard_id=dashboard_id,
                    measured_on=item.measured_on,
                )
                session.add(measurement)
            measurement.energy_kwh = item.energy_kwh
            measurement.carbon_intensity_gco2_kwh = (
                item.carbon_intensity_gco2_kwh
            )
            measurement.embodied_emissions_gco2e = (
                item.embodied_emissions_gco2e
            )
            measurement.api_calls = item.api_calls
            measurement.sci_score = sci_score
            measurement.emissions_gco2e = emissions

        session.flush()
        generated_reports = evaluate_sla_rules(session, dashboard_id)
        session.commit()
        return {
            "measurement_days": len(request.measurements),
            "reports_generated": generated_reports,
        }


@router.put("/dashboards/{dashboard_id}/sla-rules")
def save_dashboard_sla_rule(
    dashboard_id: int,
    request: SLARuleInput,
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        rule = (
            session.query(SLA_Rule)
            .filter(
                SLA_Rule.dashboard_id == dashboard_id,
                SLA_Rule.target_metric == request.target_metric,
            )
            .order_by(SLA_Rule.is_active.desc(), SLA_Rule.sla_id.desc())
            .first()
        )
        if rule is None:
            rule = SLA_Rule(
                dashboard_id=dashboard_id,
                target_metric=request.target_metric,
                max_threshold_limit=request.max_threshold_limit,
            )
            session.add(rule)
        else:
            rule.max_threshold_limit = request.max_threshold_limit
            rule.is_active = True

        if (
            session.query(Logbook.logbook_id)
            .filter(Logbook.dashboard_id == dashboard_id)
            .first()
            is None
        ):
            session.add(
                Logbook(
                    dashboard_id=dashboard_id,
                    description="Automatic dashboard SLA logbook",
                )
            )

        session.flush()
        generated_reports = evaluate_sla_rules(session, dashboard_id)
        session.commit()
        metric_label, unit = METRIC_DETAILS[request.target_metric]
        return {
            "sla_id": rule.sla_id,
            "target_metric": request.target_metric,
            "metric_label": metric_label,
            "unit": unit,
            "max_threshold_limit": rule.max_threshold_limit,
            "reports_generated": generated_reports,
        }


@router.delete("/dashboards/{dashboard_id}/sla-rules/{target_metric}")
def clear_dashboard_sla_rule(
    dashboard_id: int,
    target_metric: Literal[
        "sci", "emissions", "intensity", "energy", "embodied_emissions", "api_calls"
    ],
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        rule = (
            session.query(SLA_Rule)
            .filter(
                SLA_Rule.dashboard_id == dashboard_id,
                SLA_Rule.target_metric == target_metric,
                SLA_Rule.is_active.is_(True),
            )
            .first()
        )
        if rule is None:
            raise HTTPException(status_code=404, detail="Active limit not found")
        rule.is_active = False
        session.commit()
        return {
            "cleared": True,
            "target_metric": target_metric,
            "sla_id": rule.sla_id,
        }


@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard(
    dashboard_id: int,
    request: DashboardDelete,
    owner_id: int = Depends(authenticated_user_id),
) -> None:
    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        if dashboard.passcode_hash:
            if not request.passcode or not verify_password(
                request.passcode, dashboard.passcode_hash
            ):
                raise HTTPException(
                    status_code=403,
                    detail="Enter the correct passcode to remove this dashboard",
                )

        sla_ids = [
            row[0]
            for row in session.query(SLA_Rule.sla_id)
            .filter(SLA_Rule.dashboard_id == dashboard_id)
            .all()
        ]
        if sla_ids:
            session.query(SLA_Log).filter(SLA_Log.sla_id.in_(sla_ids)).delete(
                synchronize_session=False
            )
        session.query(SLA_Rule).filter(
            SLA_Rule.dashboard_id == dashboard_id
        ).delete(synchronize_session=False)
        session.query(DashboardImport).filter(
            DashboardImport.dashboard_id == dashboard_id
        ).delete(synchronize_session=False)
        session.query(Logbook).filter(
            Logbook.dashboard_id == dashboard_id
        ).delete(synchronize_session=False)
        session.query(Report).filter(
            Report.dashboard_id == dashboard_id
        ).delete(synchronize_session=False)
        session.query(DashboardDailyMetric).filter(
            DashboardDailyMetric.dashboard_id == dashboard_id
        ).delete(synchronize_session=False)
        session.delete(dashboard)
        session.commit()


@router.post("/dashboards/{dashboard_id}/upload-csv")
async def upload_dashboard_csv(
    dashboard_id: int,
    request: Request,
    filename: str,
    dashboard_access: str | None = Header(
        default=None, alias="X-Dashboard-Access"
    ),
    owner_id: int = Depends(authenticated_user_id),
) -> dict[str, object]:
    if len(filename.encode("utf-8")) > 255:
        raise HTTPException(status_code=422, detail="CSV filename is too long")

    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > MAX_CSV_BYTES:
            raise HTTPException(
                status_code=413, detail="CSV files must be 5 MB or smaller"
            )
        chunks.append(chunk)

    try:
        content = b"".join(chunks).decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="CSV files must use UTF-8 encoding"
        ) from exc

    with DatabaseSession(engine) as session:
        dashboard = get_owned_dashboard(session, dashboard_id, owner_id)
        require_dashboard_access(dashboard, owner_id, dashboard_access)
        imported_file = save_csv(session, dashboard, filename, content)
        session.commit()
        session.refresh(dashboard)
        session.refresh(imported_file)
        return dashboard_response(dashboard, imported_file)
