from DiagnosticLog import DiagnosticLog


class Logbook:
    # Aggregates diagnostic records for one dashboard.

    def __init__(self, dashboard_id: int) -> None:
        self.dashboard_id = dashboard_id
        self.logs: list[DiagnosticLog] = []

    @property
    def diagnostic_logs(self) -> list[DiagnosticLog]:
        # Preserve the existing public attribute name.
        return self.logs

    def register_exception(self, log: DiagnosticLog) -> None:
        if log.dashboard_id != self.dashboard_id:
            raise ValueError("Diagnostic log belongs to a different dashboard")
        if log in self.logs:
            raise ValueError("Diagnostic log is already in this logbook")
        self.logs.append(log)

    def retrieve_incident_history(self) -> list[DiagnosticLog]:
        return list(self.logs)

    def add_diagnostic_log(self, diagnostic_log: DiagnosticLog) -> None:
        self.register_exception(diagnostic_log)


# Keep the existing import used by Dashboard.py working.
LogBook = Logbook