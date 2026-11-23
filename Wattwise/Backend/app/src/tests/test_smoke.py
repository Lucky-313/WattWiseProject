"""Fast smoke tests for the WattWise core user journey."""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from main import app
import database
import Routers.dashboard_router as dashboard_router


@pytest.fixture()
def test_db(tmp_path):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'smoke.db'}",
        pool_pre_ping=True,
    )
    database.Base.metadata.create_all(test_engine)

    original_database_engine = database.engine
    original_dashboard_engine = dashboard_router.engine
    database.engine = test_engine
    dashboard_router.engine = test_engine

    yield test_engine

    database.engine = original_database_engine
    dashboard_router.engine = original_dashboard_engine


@pytest.fixture()
def client(test_db):
    with TestClient(app) as test_client:
        yield test_client


def register_user(client: TestClient, email: str = "smoke@example.com"):
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "Smoke User",
            "email": email,
            "password": "Password123!",
        },
    )
    assert response.status_code in (200, 201), response.text
    data = response.json()
    return data["user_id"], {"Authorization": f"Bearer {data['access_token']}"}


def test_1_api_health_check(client):
    public = client.get("/data")
    assert public.status_code == 200
    assert public.json() == {"message": "Hello from the FastAPI backend!"}

    _, headers = register_user(client)
    with patch(
        "Routers.dashboard_router.ExternalGridAdapter"
    ) as adapter_class:
        adapter_class.return_value.fetch_live_grid_intensity.return_value = 129.0
        telemetry = client.get("/api/telemetry", headers=headers)

    assert telemetry.status_code == 200
    assert telemetry.json()["carbon_intensity_gco2_kwh"] == 129.0


def test_2_auth_signup_and_login(client):
    _, signup_headers = register_user(client)
    assert signup_headers["Authorization"].startswith("Bearer ")

    login = client.post(
        "/api/auth/login",
        json={
            "email": "smoke@example.com",
            "password": "Password123!",
        },
    )
    assert login.status_code == 200, login.text
    assert login.json()["access_token"]
    assert login.json()["token_type"] == "bearer"


def test_3_dashboard_crud(client):
    _, headers = register_user(client)

    created = client.post(
        "/api/dashboards",
        json={
            "name": "Smoke Dashboard",
            "protect_with_passcode": False,
            "input_method": "manual",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    dashboard_id = created.json()["dashboard_id"]
    assert created.json()["name"] == "Smoke Dashboard"

    listed = client.get("/api/dashboards", headers=headers)
    assert listed.status_code == 200
    assert dashboard_id in [item["dashboard_id"] for item in listed.json()]

    read = client.get(
        f"/api/dashboards/{dashboard_id}",
        headers=headers,
    )
    assert read.status_code == 200
    assert read.json()["dashboard_id"] == dashboard_id

    deleted = client.request(
        "DELETE",
        f"/api/dashboards/{dashboard_id}",
        json={},
        headers=headers,
    )
    assert deleted.status_code == 204

    deleted_read = client.get(
        f"/api/dashboards/{dashboard_id}",
        headers=headers,
    )
    assert deleted_read.status_code == 404


def test_4_measurement_sync(client):
    _, headers = register_user(client)
    created = client.post(
        "/api/dashboards",
        json={"name": "Telemetry Smoke", "input_method": "manual"},
        headers=headers,
    )
    dashboard_id = created.json()["dashboard_id"]

    synced = client.put(
        f"/api/dashboards/{dashboard_id}/measurements",
        json={
            "measurements": [
                {
                    "measured_on": "2026-01-01",
                    "energy_kwh": 100.0,
                    "carbon_intensity_gco2_kwh": 129.0,
                    "embodied_emissions_gco2e": 20.0,
                    "api_calls": 10.0,
                },
                {
                    "measured_on": "2026-01-02",
                    "energy_kwh": 200.0,
                    "carbon_intensity_gco2_kwh": 130.0,
                    "embodied_emissions_gco2e": 30.0,
                    "api_calls": 15.0,
                },
            ]
        },
        headers=headers,
    )
    assert synced.status_code == 200, synced.text
    assert synced.json()["measurement_days"] == 2

    read = client.get(
        f"/api/dashboards/{dashboard_id}/measurements",
        headers=headers,
    )
    assert read.status_code == 200
    measurements = read.json()["measurements"]
    assert len(measurements) == 2
    assert [item["date"] for item in measurements] == [
        "2026-01-01",
        "2026-01-02",
    ]


def test_5_sci_calculation(client):
    with patch(
        "Routers.sci_router.sci_service.process_sci_calculation",
        new=AsyncMock(
            return_value={
                "sci_score": 672.9,
                "carbon_intensity": 129.0,
            }
        ),
    ):
        response = client.get("/1")

    assert response.status_code == 200
    assert "sci_score" in response.json()
    assert "carbon_intensity" in response.json()


def test_6_csv_upload(client):
    _, headers = register_user(client)
    created = client.post(
        "/api/dashboards",
        json={
            "name": "CSV Smoke",
            "protect_with_passcode": False,
            "input_method": "manual",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    dashboard_id = created.json()["dashboard_id"]

    csv_rows = [
        "date,energy_kwh,functional_unit_count,grid_intensity,carbon_emissions"
    ]
    for day in range(1, 31):
        csv_rows.append(
            f"2026-01-{day:02d},{100 + day},10,129,{12900 + day}"
        )
    csv_content = "\n".join(csv_rows) + "\n"

    uploaded = client.post(
        f"/api/dashboards/{dashboard_id}/upload-csv",
        content=csv_content,
        params={"filename": "smoke.csv"},
        headers=headers,
    )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["has_csv"] is True
    assert uploaded.json()["csv_filename"] == "smoke.csv"
