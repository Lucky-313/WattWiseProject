"""Integration tests for the WattWise dashboard API."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from main import app
import database
import Routers.dashboard_router as dashboard_router
from Security import create_access_token


@pytest.fixture()
def test_db(tmp_path):
    test_engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
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


def auth_headers(user_id: int = 1) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def create_user(client: TestClient) -> tuple[int, dict[str, str]]:
    response = client.post(
        "/api/auth/signup",
        json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "Password123!",
        },
    )
    assert response.status_code in (200, 201), response.text
    user_id = response.json()["user_id"]
    return user_id, auth_headers(user_id)


def create_dashboard(
    client: TestClient,
    headers: dict[str, str],
    name: str = "Test Dashboard",
    passcode: str | None = None,
) -> dict:
    payload = {
        "name": name,
        "protect_with_passcode": passcode is not None,
        "input_method": "manual",
    }
    if passcode is not None:
        payload["passcode"] = passcode

    response = client.post("/api/dashboards", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def mock_grid_adapter():
    with patch(
        "Routers.dashboard_router.ExternalGridAdapter"
    ) as adapter_class:
        adapter = adapter_class.return_value
        adapter.fetch_live_grid_intensity.return_value = 129.0
        yield adapter


def test_create_list_and_read_dashboard(client, mock_grid_adapter):
    _, headers = create_user(client)

    dashboard = create_dashboard(client, headers)
    assert dashboard["name"] == "Test Dashboard"
    assert dashboard["is_locked"] is False

    listed = client.get("/api/dashboards", headers=headers)
    assert listed.status_code == 200
    assert [item["dashboard_id"] for item in listed.json()] == [
        dashboard["dashboard_id"]
    ]

    read = client.get(
        f"/api/dashboards/{dashboard['dashboard_id']}",
        headers=headers,
    )
    assert read.status_code == 200
    assert read.json()["dashboard_id"] == dashboard["dashboard_id"]


def test_dashboard_creation_validation(client, mock_grid_adapter):
    _, headers = create_user(client)

    unauthenticated = client.post(
        "/api/dashboards",
        json={"name": "No Auth", "input_method": "manual"},
    )
    assert unauthenticated.status_code == 401

    missing_passcode = client.post(
        "/api/dashboards",
        json={
            "name": "Secure",
            "protect_with_passcode": True,
            "input_method": "manual",
        },
        headers=headers,
    )
    assert missing_passcode.status_code == 422

    empty_name = client.post(
        "/api/dashboards",
        json={
            "name": "",
            "protect_with_passcode": False,
            "input_method": "manual",
        },
        headers=headers,
    )
    assert empty_name.status_code == 422


def test_dashboard_limit(client, mock_grid_adapter):
    _, headers = create_user(client)
    for index in range(3):
        assert (
            create_dashboard(client, headers, f"Dashboard {index}")
            is not None
        )

    response = client.post(
        "/api/dashboards",
        json={
            "name": "Dashboard 4",
            "protect_with_passcode": False,
            "input_method": "manual",
        },
        headers=headers,
    )
    assert response.status_code == 409


def test_passcode_unlock_and_settings(client, mock_grid_adapter):
    _, headers = create_user(client)
    dashboard = create_dashboard(
        client, headers, "Secure Dashboard", "secret123"
    )
    dashboard_id = dashboard["dashboard_id"]

    wrong = client.post(
        f"/api/dashboards/{dashboard_id}/verify-passcode",
        json={"passcode": "wrong"},
        headers=headers,
    )
    assert wrong.status_code == 403

    verified = client.post(
        f"/api/dashboards/{dashboard_id}/verify-passcode",
        json={"passcode": "secret123"},
        headers=headers,
    )
    assert verified.status_code == 200
    access_token = verified.json()["dashboard_access_token"]

    locked_read = client.get(
        f"/api/dashboards/{dashboard_id}",
        headers=headers,
    )
    assert locked_read.status_code == 403

    unlocked_read = client.get(
        f"/api/dashboards/{dashboard_id}",
        headers={
            **headers,
            "X-Dashboard-Access": access_token,
        },
    )
    assert unlocked_read.status_code == 200

    changed = client.patch(
        f"/api/dashboards/{dashboard_id}/settings",
        json={
            "current_passcode": "secret123",
            "new_passcode": "new_secret",
        },
        headers=headers,
    )
    assert changed.status_code == 200

    removed = client.patch(
        f"/api/dashboards/{dashboard_id}/settings",
        json={
            "current_passcode": "new_secret",
            "remove_passcode": True,
        },
        headers=headers,
    )
    assert removed.status_code == 200
    assert removed.json()["is_locked"] is False


def test_measurement_sync_and_read(client, mock_grid_adapter):
    _, headers = create_user(client)
    dashboard = create_dashboard(client, headers)
    dashboard_id = dashboard["dashboard_id"]

    response = client.put(
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
    assert response.status_code == 200, response.text
    assert response.json()["measurement_days"] == 2

    read = client.get(
        f"/api/dashboards/{dashboard_id}/measurements",
        headers=headers,
    )
    assert read.status_code == 200
    assert len(read.json()["measurements"]) == 2


def test_sla_rule_creates_and_lists_breach_report(client, mock_grid_adapter):
    _, headers = create_user(client)
    dashboard = create_dashboard(client, headers)
    dashboard_id = dashboard["dashboard_id"]

    sync = client.put(
        f"/api/dashboards/{dashboard_id}/measurements",
        json={
            "measurements": [
                {
                    "measured_on": "2026-01-01",
                    "energy_kwh": 100.0,
                    "carbon_intensity_gco2_kwh": 129.0,
                    "embodied_emissions_gco2e": 20.0,
                    "api_calls": 10.0,
                }
            ]
        },
        headers=headers,
    )
    assert sync.status_code == 200

    rule = client.put(
        f"/api/dashboards/{dashboard_id}/sla-rules",
        json={"target_metric": "sci", "max_threshold_limit": 50.0},
        headers=headers,
    )
    assert rule.status_code == 200, rule.text
    assert rule.json()["target_metric"] == "sci"
    assert rule.json()["reports_generated"] >= 1

    logbook = client.get(
        f"/api/dashboards/{dashboard_id}/logbook",
        headers=headers,
    )
    assert logbook.status_code == 200
    assert logbook.json()["rules"][0]["target_metric"] == "sci"
    assert len(logbook.json()["reports"]) >= 1


def test_delete_dashboard(client, mock_grid_adapter):
    _, headers = create_user(client)
    dashboard = create_dashboard(client, headers)
    dashboard_id = dashboard["dashboard_id"]

    deleted = client.request(
        "DELETE",
        f"/api/dashboards/{dashboard_id}",
        json={},
        headers=headers,
    )
    assert deleted.status_code == 204

    read = client.get(
        f"/api/dashboards/{dashboard_id}",
        headers=headers,
    )
    assert read.status_code == 404


def test_delete_locked_dashboard_requires_correct_passcode(
    client, mock_grid_adapter
):
    _, headers = create_user(client)
    dashboard = create_dashboard(
        client, headers, "Delete Secure", "delete_pass"
    )
    dashboard_id = dashboard["dashboard_id"]

    wrong = client.request(
        "DELETE",
        f"/api/dashboards/{dashboard_id}",
        json={"passcode": "wrong"},
        headers=headers,
    )
    assert wrong.status_code == 403

    deleted = client.request(
        "DELETE",
        f"/api/dashboards/{dashboard_id}",
        json={"passcode": "delete_pass"},
        headers=headers,
    )
    assert deleted.status_code == 204


def test_csv_upload_validation(client, mock_grid_adapter):
    _, headers = create_user(client)
    dashboard = create_dashboard(client, headers)
    dashboard_id = dashboard["dashboard_id"]

    wrong_extension = client.post(
        f"/api/dashboards/{dashboard_id}/upload-csv",
        content="not a csv",
        params={"filename": "data.txt"},
        headers=headers,
    )
    assert wrong_extension.status_code == 415

    empty = client.post(
        f"/api/dashboards/{dashboard_id}/upload-csv",
        content="",
        params={"filename": "data.csv"},
        headers=headers,
    )
    assert empty.status_code == 422

    csv_rows = [
        "date,energy_kwh,functional_unit_count,grid_intensity,carbon_emissions"
    ]
    for day in range(1, 31):
        csv_rows.append(
            f"2026-01-{day:02d},{100 + day},{10},{129},{12900 + day}"
        )
    csv_content = "\n".join(csv_rows) + "\n"
    uploaded = client.post(
        f"/api/dashboards/{dashboard_id}/upload-csv",
        content=csv_content,
        params={"filename": "data.csv"},
        headers=headers,
    )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["has_csv"] is True
    assert uploaded.json()["csv_filename"] == "data.csv"
