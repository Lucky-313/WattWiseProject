"""Unit tests for Logbook."""
import pytest

from datetime import datetime

from LogBook import Logbook
from DiagnosticLog import DiagnosticLog


class TestLogbook:
    def test_initialization(self, dashboard_id=42):
        logbook = Logbook(dashboard_id=dashboard_id)
        assert logbook.dashboard_id == dashboard_id
        assert logbook.diagnostic_logs == []

    def test_logs_property(self, dashboard_id=42):
        logbook = Logbook(dashboard_id=dashboard_id)
        assert logbook.diagnostic_logs == []

    def test_register_exception_belongs_to_this_dashboard(self, dashboard_id=42, other_dashboard_id=99):
        logbook = Logbook(dashboard_id=dashboard_id)
        other_logbook = Logbook(dashboard_id=other_dashboard_id)
        log = DiagnosticLog(
            sla_id=1, dashboard_id=dashboard_id, metric_id=1,
            target_metric="energy", observed_value=50.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime.now(), message="test",
        )
        logbook.register_exception(log)
        assert len(logbook.diagnostic_logs) == 1

    def test_register_exception_wrong_dashboard_raises(self, dashboard_id=42, other_dashboard_id=99):
        logbook = Logbook(dashboard_id=dashboard_id)
        other_logbook = Logbook(dashboard_id=other_dashboard_id)
        log = DiagnosticLog(
            sla_id=1, dashboard_id=other_dashboard_id, metric_id=1,
            target_metric="energy", observed_value=50.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime.now(), message="test",
        )
        with pytest.raises(ValueError, match="Diagnostic log belongs to a different dashboard"):
            logbook.register_exception(log)

    def test_duplicate_log_raises(self, dashboard_id=42):
        logbook = Logbook(dashboard_id=dashboard_id)
        log = DiagnosticLog(
            sla_id=1, dashboard_id=dashboard_id, metric_id=1,
            target_metric="energy", observed_value=50.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime.now(), message="test",
        )
        logbook.register_exception(log)
        with pytest.raises(ValueError, match="Diagnostic log is already in this logbook"):
            logbook.register_exception(log)

    def test_retrieve_incident_history(self, dashboard_id=42):
        logbook = Logbook(dashboard_id=dashboard_id)
        log1 = DiagnosticLog(
            sla_id=1, dashboard_id=dashboard_id, metric_id=1,
            target_metric="energy", observed_value=50.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime(2026, 1, 1), message="test 1",
        )
        log2 = DiagnosticLog(
            sla_id=2, dashboard_id=dashboard_id, metric_id=2,
            target_metric="carbon", observed_value=30.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime(2026, 1, 2), message="test 2",
        )
        logbook.register_exception(log1)
        logbook.register_exception(log2)
        history = logbook.retrieve_incident_history()
        assert len(history) == 2
        assert history[0] is log1
        assert history[1] is log2

    def test_add_diagnostic_log_is_alias(self, dashboard_id=42):
        logbook = Logbook(dashboard_id=dashboard_id)
        log = DiagnosticLog(
            sla_id=1, dashboard_id=dashboard_id, metric_id=1,
            target_metric="energy", observed_value=50.0,
            max_threshold_limit=100.0, breached=False,
            timestamp=datetime.now(), message="test",
        )
        logbook.add_diagnostic_log(log)
        assert len(logbook.diagnostic_logs) == 1
