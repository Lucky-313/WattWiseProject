from DiagnosticLog import DiagnosticLog


class LogBook:
    # Aggregates diagnostic records without owning their source entities.

    def __init__(self) -> None:
        # Start a logbook with no recorded diagnostics.
        self.diagnostic_logs: list[DiagnosticLog] = []

    def add_diagnostic_log(self, diagnostic_log: DiagnosticLog) -> None:
        # Append a diagnostic once, preventing duplicate record entries.
        if diagnostic_log in self.diagnostic_logs:
            raise ValueError("Diagnostic log is already in this logbook")
        self.diagnostic_logs.append(diagnostic_log)