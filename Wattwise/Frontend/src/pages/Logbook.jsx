import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY, getDashboards } from "../services/api.js";
import { DEMO_SERIES } from "../services/demoTelemetry.js";

export default function Logbook() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedDashboardId = searchParams.get("dashboard");
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    getDashboards()
      .then((result) => {
        if (active) {
          setDashboards(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
          navigate("/", { replace: true });
        } else {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  function openDashboardLogbook(dashboard) {
    const dashboardToken = sessionStorage.getItem(
      `wattwise_dashboard_unlock_${dashboard.dashboard_id}`
    );
    if (dashboard.is_locked && !dashboardToken) {
      navigate(`/dashboard/${dashboard.dashboard_id}`);
      return;
    }
    navigate(`/dashboard/${dashboard.dashboard_id}/reports`);
  }

  function logout() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("wattwise_dashboard_unlock_"))
      .forEach((key) => sessionStorage.removeItem(key));
    navigate("/", { replace: true });
  }

  return (
    <main className="workspace-page">
      <div className="workspace-shell">
        <header className="workspace-topbar">
          <div className="workspace-topbar-left">
            <a className="workspace-brand" href="/home">
              <span className="workspace-brand-mark" aria-hidden="true">⚡</span>
              <span>WattWise</span>
            </a>
            <span className="workspace-header-divider" />
            <a className="workspace-header-label" href="/home">Workspaces</a>
            <span className="workspace-header-divider" />
            <span className="workspace-header-label">Logbooks</span>
          </div>
          <button type="button" className="workspace-logout" onClick={logout}>
            Log out
          </button>
        </header>

        <section className="workspace-logbook-page">
          <button
            type="button"
            className="workspace-back-link"
            onClick={() => navigate("/home")}
          >
            ← All workspaces
          </button>
          <div className="workspace-logbook-heading">
            <div>
              <span className="workspace-eyebrow">AUTOMATED SLA MONITORING</span>
              <h1>Dashboard logbooks</h1>
              <p>
                Each dashboard keeps its own limits and incident reports. Choose
                a workspace to manage its logbook.
              </p>
            </div>
            <span className="workspace-logbook-count">
              {dashboards.length.toString().padStart(2, "0")} / 03
            </span>
          </div>

          {error && <div className="workspace-page-error" role="alert">{error}</div>}
          {loading ? (
            <div className="workspace-loading" role="status">
              <span className="workspace-spinner" /> Loading your logbooks…
            </div>
          ) : dashboards.length ? (
            <div className="workspace-logbook-grid">
              {dashboards.map((dashboard) => {
                const hasDemoData =
                  String(dashboard.dashboard_id) === "1" && DEMO_SERIES.length > 0;
                const isSelected =
                  String(dashboard.dashboard_id) === selectedDashboardId;
                return (
                  <button
                    type="button"
                    key={dashboard.dashboard_id}
                    className={`workspace-logbook-card${isSelected ? " is-highlighted" : ""}`}
                    onClick={() => openDashboardLogbook(dashboard)}
                  >
                    <span className="workspace-logbook-card-top">
                      <span className="workspace-logbook-icon" aria-hidden="true">≋</span>
                      {dashboard.is_locked && (
                        <span className="workspace-lock-badge">▣ Locked</span>
                      )}
                    </span>
                    <span className="workspace-logbook-card-name">{dashboard.name}</span>
                    <span className="workspace-logbook-card-description">
                      {hasDemoData
                        ? "30 days of telemetry · limits ready"
                        : "No telemetry data yet · configure limits"}
                    </span>
                    <span className="workspace-logbook-card-footer">
                      <span>{dashboard.input_method === "csv" ? "CSV workspace" : "Manual workspace"}</span>
                      <span>Open logbook →</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <section className="workspace-detail-empty workspace-logbook-empty">
              <span className="workspace-detail-chart-icon" aria-hidden="true">≋</span>
              <h2>No dashboards yet</h2>
              <p>Create a dashboard first; its logbook will be created automatically.</p>
              <button
                type="button"
                className="workspace-secondary-button"
                onClick={() => navigate("/home")}
              >
                Go to workspaces
              </button>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
