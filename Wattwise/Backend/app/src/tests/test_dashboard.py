
from unittest.mock import MagicMock

import pytest

from DashBoard import Dashboard


@pytest.fixture
def dashboard():
    logbook = MagicMock()
    logbook.dashboard_id = 1

    grid_adapter = MagicMock()

    return Dashboard(
        dashboard_id=1,
        name="Test Dashboard",
        owner_id=10,
        is_demo=False,
        logbook=logbook,
        grid_adapter=grid_adapter
    )


# 1. Test dashboard initialisation

def test_dashboard_initialisation(dashboard):
    assert dashboard.dashboard_id == 1
    assert dashboard.name == "Test Dashboard"
    assert dashboard.owner_id == 10
    assert dashboard.is_demo is False
    assert dashboard.infrastructure == []
    assert dashboard.sla_rules == []


# 2. Test invalid logbook

def test_dashboard_rejects_wrong_logbook():
    logbook = MagicMock()
    logbook.dashboard_id = 99

    with pytest.raises(ValueError, match="Logbook belongs"):
        Dashboard(
            1, "Test Dashboard", 10, False,
            logbook, MagicMock()
        )


# 3. Test adding infrastructure

def test_add_infrastructure(dashboard):
    infrastructure = MagicMock()

    dashboard.add_infrastructure(infrastructure)

    assert infrastructure in dashboard.infrastructure
    assert len(dashboard.infrastructure) == 1


# 4. Test duplicate infrastructure

def test_add_duplicate_infrastructure(dashboard):
    infrastructure = MagicMock()

    dashboard.add_infrastructure(infrastructure)

    with pytest.raises(ValueError, match="already attached"):
        dashboard.add_infrastructure(infrastructure)

    assert len(dashboard.infrastructure) == 1


# 5. Test adding an SLA rule

def test_add_sla_rule(dashboard):
    rule = MagicMock()
    rule.dashboard_id = 1

    dashboard.add_sla_rule(rule)

    assert rule in dashboard.sla_rules
    assert len(dashboard.sla_rules) == 1


# 6. Test rejecting an SLA rule from another dashboard

def test_add_sla_rule_wrong_dashboard(dashboard):
    rule = MagicMock()
    rule.dashboard_id = 99

    with pytest.raises(ValueError, match="different dashboard"):
        dashboard.add_sla_rule(rule)

    assert dashboard.sla_rules == []


# 7. Test duplicate SLA rule

def test_add_duplicate_sla_rule(dashboard):
    rule = MagicMock()
    rule.dashboard_id = 1

    dashboard.add_sla_rule(rule)

    with pytest.raises(ValueError, match="already attached"):
        dashboard.add_sla_rule(rule)

    assert len(dashboard.sla_rules) == 1


# 8. Test dashboard summary

def test_get_dashboard_summary(dashboard):
    summary = dashboard.get_dashboard_summary()

    assert summary == {
        "dashboard_id": 1,
        "name": "Test Dashboard",
        "is_demo": False,
        "infrastructure_count": 0
    }
