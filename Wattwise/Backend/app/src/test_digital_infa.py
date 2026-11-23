"""Unit tests for DigitalInfrastructure."""
import pytest

from datetime import datetime

from DigitalInfa import DigitalInfrastructure
from SciMetric import SCIMetric


class TestDigitalInfrastructure:
    def test_initialization(self, infra_id=1, name="Test Infra"):
        infra = DigitalInfrastructure(infra_id=infra_id, name=name)
        assert infra.infra_id == infra_id
        assert infra.name == name
        assert infra.functional_unit_type == ""
        assert infra.historical_metrics == []

    def test_metrics_property(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        assert infra.metrics == []

    def test_record_metric_belongs_to_this_infra(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        metric = SCIMetric(
            metric_id=1, infra_id=infra_id, timestamp=datetime.now(),
            energy_consumed=100, grid_intensity=0.5,
            embodied_emissions=20, functional_unit_count=10,
            calculated_sci=0.0,
        )
        infra.record_metric(metric)
        assert len(infra.historical_metrics) == 1
        assert infra.historical_metrics[0] is metric

    def test_record_metric_wrong_infra_raises(self, infra_id=1, infra_id2=2):
        infra = DigitalInfrastructure(infra_id=infra_id)
        wrong_infra = DigitalInfrastructure(infra_id=infra_id2)
        metric = SCIMetric(
            metric_id=1, infra_id=infra_id2, timestamp=datetime.now(),
            energy_consumed=100, grid_intensity=0.5,
            embodied_emissions=20, functional_unit_count=10,
            calculated_sci=0.0,
        )
        with pytest.raises(ValueError, match="SCI metric belongs to a different infrastructure"):
            infra.record_metric(metric)

    def test_duplicate_metric_raises(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        metric = SCIMetric(
            metric_id=1, infra_id=infra_id, timestamp=datetime.now(),
            energy_consumed=100, grid_intensity=0.5,
            embodied_emissions=20, functional_unit_count=10,
            calculated_sci=0.0,
        )
        infra.record_metric(metric)
        with pytest.raises(ValueError, match="SCI metric is already attached to this infrastructure"):
            infra.record_metric(metric)

    def test_get_latest_metric_when_empty_raises(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        with pytest.raises(ValueError, match="No metrics have been recorded for this infrastructure"):
            infra.get_latest_metric()

    def test_get_latest_metric_returns_last(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        m1 = SCIMetric(
            metric_id=1, infra_id=infra_id, timestamp=datetime(2026, 1, 1),
            energy_consumed=100, grid_intensity=0.5,
            embodied_emissions=20, functional_unit_count=10,
            calculated_sci=0.0,
        )
        m2 = SCIMetric(
            metric_id=2, infra_id=infra_id, timestamp=datetime(2026, 1, 2),
            energy_consumed=200, grid_intensity=0.6,
            embodied_emissions=30, functional_unit_count=15,
            calculated_sci=0.0,
        )
        infra.record_metric(m1)
        infra.record_metric(m2)
        assert infra.get_latest_metric() is m2

    def test_add_metric_is_alias_for_record_metric(self, infra_id=1):
        infra = DigitalInfrastructure(infra_id=infra_id)
        metric = SCIMetric(
            metric_id=1, infra_id=infra_id, timestamp=datetime.now(),
            energy_consumed=100, grid_intensity=0.5,
            embodied_emissions=20, functional_unit_count=10,
            calculated_sci=0.0,
        )
        infra.add_metric(metric)
        assert len(infra.historical_metrics) == 1