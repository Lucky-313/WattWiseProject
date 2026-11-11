import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ACCESS_TOKEN_KEY,
  clearDashboardSlaRule,
  getDashboard,
  getDashboardLogbook,
  saveDashboardSlaRule,
  syncDashboardMeasurements,
} from "../services/api.js";
import { DEMO_SERIES } from "../services/demoTelemetry.js";

const metricOptions = [
  { key: "sci", label: "Software carbon intensity", unit: "gCO₂e / API call", example: 0.04 },
  { key: "emissions", label: "Carbon emissions", unit: "kgCO₂e / day", example: 4 },
  { key: "intensity", label: "Grid carbon intensity", unit: "gCO₂e / kWh", example: 300 },
  { key: "energy", label: "Energy consumption", unit: "kWh / day", example: 15 },
  { key: "embodied_emissions", label: "Embodied emissions", unit: "gCO₂e / day", example: 300 },
  { key: "api_calls", label: "API calls", unit: "calls / day", example: 100000 },
];

function displayNumber(value, digits = 3) {
  return Number(value).toLocaleString("en", { maximumFractionDigits: digits });
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function ReportModal({ report, onClose }) {
  const details = report.details;
  const breaches = details.breaches || [details];
  return (
    <div
      className="workspace-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="workspace-modal workspace-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-report-title"
      >
        <div className="workspace-modal-heading">
          <div>
            <span className="workspace-eyebrow">SUSTAINABILITY BREACH REPORT</span>
            <h2 id="workspace-report-title">{report.report_name}</h2>
          </div>
          <button
            type="button"
            className="workspace-modal-close"
            aria-label="Close report"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="workspace-report-date">{details.message}</p>
        <div className="workspace-report-breach-summary">
          <span>{breaches.length} metric limit{breaches.length === 1 ? "" : "s"} exceeded</span>
          {breaches.map((breach) => (
            <div className="workspace-report-breach-item" key={`${breach.target_metric}-${breach.sla_id}`}>
              <strong>{breach.metric_label}</strong>
              <span>
                {displayNumber(breach.observed_value)} {breach.unit}
                {" · limit "}
                {displayNumber(breach.max_threshold_limit)} {breach.unit}
                {" · over by "}
                {displayNumber(breach.difference)} {breach.unit}
              </span>
              <small>
                {breach.percentage_over == null
                  ? "The configured limit was zero."
                  : `${displayNumber(breach.percentage_over, 1)}% above the configured limit`}
              </small>
            </div>
          ))}
        </div>
        <dl className="workspace-report-detail-grid">
          <div>
            <dt>Day's SCI</dt>
            <dd>{displayNumber(details.sci_score, 6)} gCO₂e / API call</dd>
          </div>
          <div>
            <dt>Day's emissions</dt>
            <dd>{displayNumber(details.emissions_kgco2e)} kgCO₂e</dd>
          </div>
          <div>
            <dt>Energy consumption</dt>
            <dd>{displayNumber(details.energy_kwh)} kWh</dd>
          </div>
          <div>
            <dt>Grid carbon intensity</dt>
            <dd>{displayNumber(details.carbon_intensity_gco2_kwh)} gCO₂e / kWh</dd>
          </div>
          <div>
            <dt>Embodied emissions</dt>
            <dd>{displayNumber(details.embodied_emissions_gco2e)} gCO₂e</dd>
          </div>
          <div>
            <dt>API calls</dt>
            <dd>{displayNumber(details.api_calls, 0)}</dd>
          </div>
        </dl>
        <div className="workspace-report-modal-actions">
          <button
            type="button"
            className="workspace-primary-button workspace-report-download"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
          <button
            type="button"
            className="workspace-secondary-button workspace-report-close"
            onClick={onClose}
          >
            Close report
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Reports() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [logbook, setLogbook] = useState(null);
  const [limitDrafts, setLimitDrafts] = useState({});
  const [addingMetricKey, setAddingMetricKey] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingMetric, setSavingMetric] = useState("");
  const [clearingAll, setClearingAll] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const activeRules = logbook?.rules || [];
  const availableMetrics = metricOptions.filter(
    (metric) => !activeRules.some((rule) => rule.target_metric === metric.key)
  );

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    async function load() {
      try {
        const dashboardData = await getDashboard(id);
        if (!active) return;
        setDashboard(dashboardData);

        if (String(dashboardData.dashboard_id) === "1") {
          await syncDashboardMeasurements(
            id,
            DEMO_SERIES.map((day) => ({
              measured_on: localDateKey(day.date),
              energy_kwh: day.energy,
              carbon_intensity_gco2_kwh: day.intensity,
              embodied_emissions_gco2e: day.embodied,
              api_calls: day.apiCalls,
            }))
          );
        }

        const logbookData = await getDashboardLogbook(id);
        if (active) {
          setLogbook(logbookData);
          setError("");
        }
      } catch (requestError) {
        if (!active) return;
        if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
          navigate("/", { replace: true });
        } else if (requestError.message.includes("Unlock this dashboard")) {
          navigate(`/dashboard/${encodeURIComponent(id)}`, { replace: true });
        } else {
          setError(requestError.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  useEffect(() => {
    setLimitDrafts(
      Object.fromEntries(
        (logbook?.rules || []).map((rule) => [
          rule.target_metric,
          String(rule.max_threshold_limit),
        ])
      )
    );
  }, [logbook]);

  async function refreshLogbook() {
    setLogbook(await getDashboardLogbook(id));
  }

  async function saveLimit(event, targetMetric, value) {
    event.preventDefault();
    const numericLimit = Number(value);
    if (!Number.isFinite(numericLimit) || numericLimit < 0) {
      setError("Enter a non-negative limit.");
      return;
    }

    setSavingMetric(targetMetric);
    setError("");
    setNotice("");
    try {
      const result = await saveDashboardSlaRule(id, {
        target_metric: targetMetric,
        max_threshold_limit: numericLimit,
      });
      await refreshLogbook();
      setAddingMetricKey("");
      setNewLimit("");
      setNotice(
        result.reports_generated
          ? `${result.reports_generated} new breach report${result.reports_generated === 1 ? "" : "s"} added.`
          : "Limit saved. Existing daily reports are updated when another limit breaches on the same day."
      );
    } catch (requestError) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
      } else {
        setError(requestError.message);
      }
    } finally {
      setSavingMetric("");
    }
  }

  async function removeLimit(targetMetric) {
    setSavingMetric(targetMetric);
    setError("");
    setNotice("");
    try {
      await clearDashboardSlaRule(id, targetMetric);
      await refreshLogbook();
      setNotice("Limit removed. Existing breach reports have been kept.");
    } catch (requestError) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
      } else {
        setError(requestError.message);
      }
    } finally {
      setSavingMetric("");
    }
  }

  async function removeAllLimits() {
    setClearingAll(true);
    setError("");
    setNotice("");
    try {
      for (const rule of activeRules) {
        await clearDashboardSlaRule(id, rule.target_metric);
      }
      await refreshLogbook();
      setNotice("All active limits removed. Existing breach reports have been kept.");
    } catch (requestError) {
      if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
        navigate("/", { replace: true });
      } else {
        setError(requestError.message);
      }
      await refreshLogbook();
    } finally {
      setClearingAll(false);
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
            <a className="workspace-header-label" href="/logbook">Logbooks</a>
            {dashboard && (
              <>
                <span className="workspace-header-divider" />
                <span className="workspace-header-label">{dashboard.name}</span>
              </>
            )}
          </div>
          <button type="button" className="workspace-logout" onClick={logout}>
            Log out
          </button>
        </header>

        <section className="workspace-report-page">
          <button
            type="button"
            className="workspace-back-link"
            onClick={() => navigate(`/logbook?dashboard=${encodeURIComponent(id)}`)}
          >
            ← All dashboard logbooks
          </button>
          <div className="workspace-report-heading">
            <div>
              <span className="workspace-eyebrow">AUTOMATED SLA MONITORING</span>
              <h1>{dashboard ? `${dashboard.name} logbook` : "Dashboard logbook"}</h1>
              <p>
                Set a maximum for any tracked metric. Daily readings above the
                limit are saved as reports for this dashboard.
              </p>
            </div>
            {logbook && (
              <span className="workspace-logbook-data-count">
                {logbook.measurement_days} DATA DAYS
              </span>
            )}
          </div>

          {error && <div className="workspace-page-error" role="alert">{error}</div>}
          {notice && <div className="workspace-report-notice" role="status">{notice}</div>}

          {loading ? (
            <div className="workspace-loading" role="status">
              <span className="workspace-spinner" /> Loading dashboard logbook…
            </div>
          ) : logbook ? (
            <>
              <section className="workspace-report-limit-card">
                <div className="workspace-report-section-heading">
                  <div>
                    <span className="workspace-card-label">SUSTAINABILITY BOUNDARY</span>
                    <h2>Monitoring limits</h2>
                    <p>
                      Set one or more limits. Breaches from the same day are grouped
                      into a single report.
                    </p>
                  </div>
                  <span className="workspace-report-rule-count">
                    {activeRules.length} / {metricOptions.length} LIMITS
                  </span>
                </div>
                {activeRules.length > 0 && (
                  <div className="workspace-active-limit-list">
                    {activeRules.map((rule) => (
                      <form
                        key={rule.sla_id}
                        className="workspace-active-limit"
                        onSubmit={(event) =>
                          saveLimit(
                            event,
                            rule.target_metric,
                            limitDrafts[rule.target_metric]
                          )
                        }
                      >
                        <div className="workspace-active-limit-title">
                          <span>{rule.metric_label}</span>
                          <small>{rule.unit}</small>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={limitDrafts[rule.target_metric] ?? ""}
                          onChange={(event) =>
                            setLimitDrafts((drafts) => ({
                              ...drafts,
                              [rule.target_metric]: event.target.value,
                            }))
                          }
                          aria-label={`${rule.metric_label} maximum`}
                        />
                        <span className="workspace-active-limit-unit">{rule.unit}</span>
                        <button
                          type="submit"
                          className="workspace-active-limit-save"
                          disabled={Boolean(savingMetric) || clearingAll}
                        >
                          {savingMetric === rule.target_metric ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="workspace-active-limit-remove"
                          onClick={() => removeLimit(rule.target_metric)}
                          disabled={Boolean(savingMetric) || clearingAll}
                          aria-label={`Remove ${rule.metric_label} limit`}
                        >
                          Remove
                        </button>
                      </form>
                    ))}
                    <button
                      type="button"
                      className="workspace-clear-all-limits"
                      onClick={removeAllLimits}
                      disabled={Boolean(savingMetric) || clearingAll}
                    >
                      {clearingAll ? "Clearing limits…" : "Clear all limits"}
                    </button>
                  </div>
                )}

                {availableMetrics.length > 0 && (
                  <div className="workspace-add-limit-section">
                    <span className="workspace-add-limit-label">
                      {activeRules.length ? "Add another metric limit" : "Choose a metric to monitor"}
                    </span>
                    <div className="workspace-add-limit-options">
                      {availableMetrics.map((metric) => (
                        <button
                          type="button"
                          key={metric.key}
                          className={`workspace-add-limit-chip${addingMetricKey === metric.key ? " is-active" : ""}`}
                          onClick={() => {
                            setAddingMetricKey(metric.key);
                            setNewLimit(String(metric.example));
                            setError("");
                          }}
                        >
                          <span aria-hidden="true">+</span> {metric.label}
                        </button>
                      ))}
                    </div>
                    {addingMetricKey && (
                      <form
                        className="workspace-add-limit-form"
                        onSubmit={(event) => saveLimit(event, addingMetricKey, newLimit)}
                      >
                        <div>
                          <strong>
                            {metricOptions.find((metric) => metric.key === addingMetricKey).label}
                          </strong>
                          <span>
                            Set a maximum in{" "}
                            {metricOptions.find((metric) => metric.key === addingMetricKey).unit}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={newLimit}
                          onChange={(event) => setNewLimit(event.target.value)}
                          aria-label={`New ${metricOptions.find((metric) => metric.key === addingMetricKey).label} limit`}
                        />
                        <button
                          type="submit"
                          className="workspace-finish-button"
                          disabled={Boolean(savingMetric)}
                        >
                          {savingMetric === addingMetricKey ? "Saving…" : "Add limit"}
                        </button>
                        <button
                          type="button"
                          className="workspace-add-limit-cancel"
                          onClick={() => setAddingMetricKey("")}
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                )}
                {logbook.measurement_days === 0 && (
                  <p className="workspace-report-no-data">
                    No daily measurements are attached to this dashboard yet.
                    The limit will be checked as soon as data is available.
                  </p>
                )}
              </section>

              <section className="workspace-report-list-section">
                <div className="workspace-report-section-heading">
                  <div>
                    <span className="workspace-card-label">INCIDENT HISTORY</span>
                    <h2>Breach reports</h2>
                    <p>Reports are retained as a timeline and do not replace older incidents.</p>
                  </div>
                  <span className="workspace-report-rule-count">
                    {logbook.reports.length} REPORTS
                  </span>
                </div>
                {logbook.reports.length ? (
                  <div className="workspace-breach-list">
                    {logbook.reports.map((report) => (
                      <button
                        type="button"
                        key={report.report_id}
                        className="workspace-breach-card"
                        onClick={() => setSelectedReport(report)}
                      >
                        <span className="workspace-breach-indicator" aria-hidden="true">!</span>
                        <span className="workspace-breach-copy">
                          <strong>{report.report_name}</strong>
                          <small>
                            {report.details.breaches?.length || 1} metric limit
                            {(report.details.breaches?.length || 1) === 1 ? "" : "s"} breached
                            {" · "}SCI {displayNumber(report.details.sci_score, 6)}
                          </small>
                        </span>
                        <span className="workspace-breach-observed">
                          <strong>
                            {report.details.breaches?.length || 1} breach
                            {(report.details.breaches?.length || 1) === 1 ? "" : "es"}
                          </strong>
                          <small>view daily report →</small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="workspace-report-empty">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>No breach reports yet</strong>
                      <p>
                        {logbook.measurement_days
                          ? "Current readings are within their configured limits, or no limits have been set."
                          : "Reports will appear here when data exceeds a configured limit."}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </section>
      </div>
      {selectedReport && (
        <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </main>
  );
}
