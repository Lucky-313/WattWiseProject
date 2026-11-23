"""Integration tests for SCI API endpoint (sci_router.py).

Confirm service outcomes map to expected HTTP responses:
- 200: successful SCI calculation
- 404: measurement not found (KeyError)
- 422: invalid calculation data (ValueError)
- 500: internal server error (unexpected exception)
"""
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

# Build the FastAPI app from the project's main
sys_path = str(Path(__file__).resolve().parents[1])
import sys
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

from main import app  # noqa: E402
from database import engine, Base  # noqa: E402


# ──────────────────────────────────────────────────────────────────────
# Test database setup (in-memory SQLite)
# ──────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def test_db():
    """Create an in-memory SQLite database and initialize tables."""
    import tempfile
    import os

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_path = tmp.name

    from sqlalchemy import create_engine
    test_engine = create_engine(f"sqlite:///{db_path}", pool_pre_ping=True)
    Base.metadata.create_all(test_engine)

    import database
    original_engine = database.engine
    database.engine = test_engine

    yield test_engine

    database.engine = original_engine
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def client(test_db):
    """Return a TestClient for the FastAPI app."""
    return TestClient(app)


# ──────────────────────────────────────────────────────────────────────
# SCI API tests
# ──────────────────────────────────────────────────────────────────────

class TestSCIAPI:
    def test_calculate_sci_success(self, client):
        """Service returns a valid result -> HTTP 200 with sci_score."""
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

        assert response.status_code == 200, response.text
        data = response.json()
        assert "sci_score" in data
        assert "carbon_intensity" in data

    def test_calculate_sci_not_found(self, client):
        """Service raises KeyError (no measurement) -> HTTP 404."""
        with patch(
            "Routers.sci_router.sci_service.process_sci_calculation",
            new=AsyncMock(side_effect=KeyError("No measurement found")),
        ):
            response = client.get("/999")  # non-existent service_id

        assert response.status_code == 404, response.text
        assert "detail" in response.json()

    def test_calculate_sci_invalid_data(self, client):
        """Service raises ValueError (invalid data) -> HTTP 422."""
        with patch(
            "Routers.sci_router.sci_service.process_sci_calculation",
            new=AsyncMock(
                side_effect=ValueError(
                    "Measurement contains invalid calculation data"
                )
            ),
        ):
            response = client.get("/1")

        assert response.status_code == 422, response.text
        assert "detail" in response.json()

    def test_calculate_sci_internal_error(self, client):
        """Service raises unexpected exception -> HTTP 500."""
        with patch(
            "Routers.sci_router.sci_service.process_sci_calculation",
            new=AsyncMock(side_effect=RuntimeError("DB connection failed")),
        ):
            response = client.get("/1")

        assert response.status_code == 500, response.text
        assert "detail" in response.json()

    def test_read_root(self, client):
        """GET /data returns hello message -> HTTP 200."""
        response = client.get("/data")
        assert response.status_code == 200
        assert response.json() == {"message": "Hello from the FastAPI backend!"}
