class Dashboard:

    # creates a new dashboard object
    def __init__(self, dashboard_id: int, name: str, owner_id: int, is_demo: bool):

        self.dashboard_id = dashboard_id
        self.name = name
        self.owner_id = owner_id
        self.is_demo = is_demo

        # lists that hold the dashboard's infrastructure and SLA rules
        self.infrastructure = []
        self.sla_rules = []
        # Placeholder for dashboard logbook
        self.logbook = None


    # adds infrastructure object to this dashboard's list
    def add_infrastructure(self, infra):
        self.infrastructure.append(infra)

    # returns a summary of the dashboard 
    def get_dashboard_summary(self):

        return {
            "dashboard_id": self.dashboard_id,
            "name": self.name,
            "is_demo": self.is_demo,
            "infrastructure_count": len(self.infra)
        }
