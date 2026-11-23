import json
from datetime import date
from unittest.mock import MagicMock
from types import SimpleNamespace

import pytest

import ExternalGridAdapter as adapter_module
from ExternalGridAdapter import ExternalGridAdapter, GridIntensityFetchError


@pytest.fixture
def adapter():
    return ExternalGridAdapter()


def mock_response(payload):
    response = MagicMock()
    response.read.return_value = json.dumps(payload).encode("utf-8")
    response.__enter__.return_value = response
    return response


# 1. Test live grid intensity (actual and forecast)

@pytest.mark.parametrize(
    "actual, forecast, expected",
    [
        (150, 160, 150.0),
        (None, 175, 175.0)
    ]
)
def test_fetch_live_grid_intensity(
    adapter, monkeypatch, actual, forecast, expected
):
    payload = {
        "data": [
            {"intensity": {"actual": actual, "forecast": forecast}}
        ]
    }

    monkeypatch.setattr(
        adapter_module, "urlopen",
        lambda *args, **kwargs: mock_response(payload)
    )

    assert adapter.fetch_live_grid_intensity() == expected


# 2. Test live intensity fallback when API fails

def test_fetch_live_grid_intensity_fallback(adapter, monkeypatch):
    def raise_error(*args, **kwargs):
        raise OSError("API unavailable")

    monkeypatch.setattr(adapter_module, "urlopen", raise_error)

    assert adapter.fetch_live_grid_intensity() == 129.0


# 3. Test daily grid intensity averaging

def test_fetch_daily_grid_intensity(adapter, monkeypatch):
    payload = {
        "data": [
            {
                "from": "2026-01-01T00:00Z",
                "intensity": {"actual": 100}
            },
            {
                "from": "2026-01-01T00:30Z",
                "intensity": {"actual": 200}
            },
            {
                "from": "2026-01-02T00:00Z",
                "intensity": {"actual": 150}
            }
        ]
    }

    monkeypatch.setattr(
        adapter_module, "urlopen",
        lambda *args, **kwargs: mock_response(payload)
    )

    result = adapter.fetch_daily_grid_intensity(
        date(2026, 1, 1), date(2026, 1, 2)
    )

    assert result == {
        date(2026, 1, 1): 150.0,
        date(2026, 1, 2): 150.0
    }


# 4. Test daily intensity error handling

@pytest.mark.parametrize(
    "start_date, end_date, error_type, response",
    [
        (
            date(2026, 1, 5),
            date(2026, 1, 1),
            ValueError,
            None
        ),
        (
            date(2026, 1, 1),
            date(2026, 1, 1),
            GridIntensityFetchError,
            None
        ),
        (
            date(2026, 1, 1),
            date(2026, 1, 1),
            GridIntensityFetchError,
            {"data": []}
        )
    ]
)
def test_fetch_daily_grid_intensity_errors(
    adapter, monkeypatch, start_date, end_date, error_type, response
):
    if response is None and error_type == GridIntensityFetchError:
        def raise_error(*args, **kwargs):
            raise OSError("API unavailable")

        monkeypatch.setattr(adapter_module, "urlopen", raise_error)

    elif response is not None:
        monkeypatch.setattr(
            adapter_module, "urlopen",
            lambda *args, **kwargs: mock_response(response)
        )

    with pytest.raises(error_type):
        adapter.fetch_daily_grid_intensity(start_date, end_date)


# 5. Test generation mix retrieval and conversion

def test_fetch_live_generation_mix(adapter, monkeypatch):
    payload = {
        "data": {
            "generationmix": [
                {"fuel": "wind", "perc": 45.5},
                {"fuel": "gas", "perc": 54.5}
            ]
        }
    }

    monkeypatch.setattr(
        adapter_module, "urlopen",
        lambda *args, **kwargs: mock_response(payload)
    )

    assert adapter.fetch_live_generation_mix() == [
        {"fuel": "wind", "percentage": 45.5},
        {"fuel": "gas", "percentage": 54.5}
    ]


# 6. Test applying grid intensity to SCI metric

def test_apply_grid_intensity(adapter):
    metric = SimpleNamespace(grid_intensity=None)

    adapter.apply_grid_intensity(metric, 150.0)

    assert metric.grid_intensity == 150.0
