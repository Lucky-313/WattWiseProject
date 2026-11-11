import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY, getDashboard, verifyDashboardPasscode } from "../services/api.js";

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    setLoading(true);
    getDashboard(id)
      .then((result) => {
        if (active) {
          setDashboard(result);
          setNeedsUnlock(false);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
          navigate("/", { replace: true });
        } else if (requestError.message.includes("Unlock this dashboard")) {
          setNeedsUnlock(true);
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
  }, [id, navigate]);

  async function unlock(event) {
    event.preventDefault();
    setError("");
    setUnlocking(true);
    try {
      const result = await verifyDashboardPasscode(id, passcode);
      if (result.dashboard_access_token) {
        sessionStorage.setItem(
          `wattwise_dashboard_unlock_${id}`,
          result.dashboard_access_token
        );
      }
      const unlockedDashboard = await getDashboard(id);
      setDashboard(unlockedDashboard);
      setNeedsUnlock(false);
    } catch (requestError) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
      } else {
        setError(requestError.message);
      }
    } finally {
      setUnlocking(false);
    }
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
          </div>
          <button type="button" className="workspace-logout" onClick={logout}>
            Log out
          </button>
        </header>

        {loading ? (
          <div className="workspace-detail-state">
            <span className="workspace-spinner" /> Loading dashboard…
          </div>
        ) : needsUnlock ? (
          <section className="workspace-unlock-panel">
            <span className="workspace-lock-symbol" aria-hidden="true">▣</span>
            <span className="workspace-eyebrow">PRIVATE WORKSPACE</span>
            <h1>Unlock this dashboard</h1>
            <p>Enter the dashboard passcode to view its data.</p>
            <form onSubmit={unlock}>
              <label className="workspace-field-label" htmlFor="detail-passcode">Passcode</label>
              <input
                id="detail-passcode"
                className="workspace-input"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
              {error && <p className="workspace-form-error" role="alert">{error}</p>}
              <button type="submit" className="workspace-finish-button" disabled={unlocking}>
                {unlocking ? <><span className="workspace-spinner" /> Unlocking…</> : "Unlock dashboard"}
              </button>
            </form>
            <button type="button" className="workspace-back-link" onClick={() => navigate("/home")}>
              ← Back to workspaces
            </button>
          </section>
        ) : error ? (
          <section className="workspace-detail-state workspace-detail-error">
            <h1>Dashboard unavailable</h1>
            <p>{error}</p>
            <button type="button" className="workspace-secondary-button" onClick={() => navigate("/home")}>
              Back to workspaces
            </button>
          </section>
        ) : dashboard ? (
          <section className="workspace-detail">
            <button type="button" className="workspace-back-link" onClick={() => navigate("/home")}>
              ← All workspaces
            </button>
            <div className="workspace-detail-heading">
              <div>
                <span className="workspace-eyebrow">WORKSPACE DASHBOARD</span>
                <h1>{dashboard.name}</h1>
                <p>
                  {dashboard.is_locked ? "Passcode protected" : "Private to your account"}
                  {" · "}
                  {dashboard.input_method === "csv" ? "CSV data source" : "Manual data source"}
                </p>
              </div>
              <div className="workspace-detail-actions">
                {dashboard.is_locked && <span className="workspace-lock-badge">▣ Locked</span>}
                <button
                  type="button"
                  className="workspace-settings-button"
                  aria-label={`Settings for ${dashboard.name}`}
                  title="Dashboard settings"
                  onClick={() =>
                    navigate(`/home?settings=${encodeURIComponent(id)}`)
                  }
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="m19.2 13.1 1.1.85-1.6 2.77-1.3-.52a7.6 7.6 0 0 1-1.7.98l-.2 1.4h-3.2l-.2-1.4a7.6 7.6 0 0 1-1.7-.98l-1.3.52-1.6-2.77 1.1-.85a7.8 7.8 0 0 1 0-2.2l-1.1-.85 1.6-2.77 1.3.52a7.6 7.6 0 0 1 1.7-.98l.2-1.4h3.2l.2 1.4a7.6 7.6 0 0 1 1.7.98l1.3-.52 1.6 2.77-1.1.85a7.8 7.8 0 0 1 0 2.2Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="workspace-detail-grid">
              <article className="workspace-detail-card">
                <span className="workspace-card-label">SOFTWARE CARBON INTENSITY</span>
                <strong className="workspace-detail-metric">
                  {dashboard.sci_summary == null
                    ? "—"
                    : Number(dashboard.sci_summary).toFixed(3)}
                </strong>
                <span className="workspace-card-caption">
                  {dashboard.sci_summary == null
                    ? "No SCI summary available yet"
                    : "gCO₂e per functional unit"}
                </span>
              </article>
              <article className="workspace-detail-card">
                <span className="workspace-card-label">DATA SOURCE</span>
                <strong className="workspace-detail-metric workspace-detail-source">
                  {dashboard.has_csv ? "CSV imported" : "Manual entry"}
                </strong>
                <span className="workspace-card-caption">
                  {dashboard.csv_filename || "No data file attached"}
                </span>
              </article>
            </div>
            <section className="workspace-detail-empty">
              <span className="workspace-detail-chart-icon" aria-hidden="true">⌁</span>
              <h2>Your sustainability data will appear here</h2>
              <p>
                {dashboard.has_csv
                  ? `${dashboard.csv_filename} is saved to this workspace.`
                  : "Add measurements to start tracking energy use and carbon intensity."}
              </p>
              <span className="workspace-sci">SCI · ISO 21031</span>
            </section>
          </section>
        ) : null}
      </div>

    </main>
  );
}
