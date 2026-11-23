
from datetime import datetime

import SciMetric as metric_module
from SciMetric import SCIMetric


def create_metric():
    return SCIMetric(
        metric_id=1,
        infra_id=10,
        timestamp=datetime(2026, 1, 1),
        energy_consumed=100.0,
        grid_intensity=150.0,
        embodied_emissions=20.0,
        functional_unit_count=5.0,
        calculated_sci=0.0
    )


# 1. Test SCIMetric initialisation

def test_sci_metric_initialisation():
    metric = create_metric()

    assert metric.metric_id == 1
    assert metric.infra_id == 10
    assert metric.energy_consumed == 100.0
    assert metric.grid_intensity == 150.0
    assert metric.embodied_emissions == 20.0
    assert metric.functional_unit_count == 5.0
    assert metric.calculated_sci == 0.0


# 2. Test SCI calculation and result storage

def test_sci_metric_calculate(monkeypatch):
    metric = create_metric()
    received_values = []

    def mock_calculate_sci(energy, intensity, emissions, units):
        received_values.append((energy, intensity, emissions, units))
        return 460.0

    monkeypatch.setattr(
        metric_module, "calculate_sci", mock_calculate_sci
    )

    result = metric.calculate()

    assert received_values == [(100.0, 150.0, 20.0, 5.0)]
    assert result == 460.0
    assert metric.calculated_sci == 460.0


# 3. Test SCI recalculation updates existing result

def test_sci_metric_recalculate(monkeypatch):
    metric = create_metric()
    results = iter([460.0, 500.0])

    monkeypatch.setattr(
        metric_module,
        "calculate_sci",
        lambda *args: next(results)
    )

    first_result = metric.calculate()
    second_result = metric.calculate()

    assert first_result == 460.0
    assert second_result == 500.0
    assert metric.calculated_sci == 500.0
