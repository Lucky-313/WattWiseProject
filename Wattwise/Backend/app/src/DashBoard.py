from DigitalInfa import DigitalInfrastructure
from ExternalGridAdapter import ExternalGridAdapter
from LogBook import LogBook
from SLARule import SLARule


class Dashboard:
    # Owns dashboard infrastructure and SLA rules and links related services.

    def __init__(
        self,
        dashboard_id: int,
        name: str,
        owner_id: int,
        is_demo: bool,
        logbook: LogBook,
        grid_adapter: ExternalGridAdapter,
    ) -> None:
        # Create a dashboard with its required logbook and grid adapter.
        # Infrastructure and SLA rules belong to this dashboard; the logbook
        # and adapter are required collaborators.
        self.dashboard_id = dashboard_id
        self.name = name
        self.owner_id = owner_id
        self.is_demo = is_demo
        self.infrastructure: list[DigitalInfrastructure] = []
        self.sla_rules: list[SLARule] = []
        self.logbook = logbook
        self.grid_adapter = grid_adapter

    def add_sla_rule(self, rule: SLARule) -> None:
        # Attach an SLA rule only if it belongs to this dashboard.
        if rule.dashboard_id != self.dashboard_id:
            raise ValueError("SLA rule belongs to a different dashboard")
        if rule in self.sla_rules:
            raise ValueError("SLA rule is already attached to this dashboard")
        self.sla_rules.append(rule)

    def add_infrastructure(self, infrastructure: DigitalInfrastructure) -> None:
        # Add infrastructure to this dashboard's composition collection.
        if infrastructure in self.infrastructure:
            raise ValueError("Infrastructure is already attached to this dashboard")
        self.infrastructure.append(infrastructure)

    def get_dashboard_summary(self) -> dict[str, object]:
        # Return identifying data and the number of attached infrastructures.
        return {
            "dashboard_id": self.dashboard_id,
            "name": self.name,
            "is_demo": self.is_demo,
            "infrastructure_count": len(self.infrastructure),
        }
