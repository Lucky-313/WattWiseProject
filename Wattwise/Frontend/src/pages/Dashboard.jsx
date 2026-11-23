import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY, getDashboard, verifyDashboardPasscode } from "../services/api.js";
import { DEMO_SERIES } from "../services/demoTelemetry.js";
import SimulationPanel from "../Components/dashboard/SimulationPanel.jsx";

const metricOptions = {
  sci: {
    label: "SCI",
    color: "#0284c7",
    unit: "gCO₂e / API call",
    value: (day) => day.sci,
    format: (value) => value.toFixed(6),
  },
  emissions: {
    label: "Emissions",
    color: "#10b981",
    unit: "kgCO₂e",
    value: (day) => day.emissions,
    format: (value) => value.toFixed(1),
  },
  intensity: {
    label: "Grid intensity",
    color: "#8b5cf6",
    unit: "gCO₂e / kWh",
    value: (day) => day.intensity,
    format: (value) => value.toFixed(1),
  },
  energy: {
    label: "Energy",
    color: "#f59e0b",
    unit: "kWh",
    value: (day) => day.energy,
    format: (value) => value.toFixed(1),
  },
};

function formatDay(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(date);
}

function getWeeklyPeriods(days) {
  const weekCount = Math.min(4, Math.floor(days.length / 7));
  return Array.from({ length: weekCount }, (_, index) => {
    const week = days.slice(index * 7, (index + 1) * 7);
    return {
      label: `Week ${index + 1}`,
      start: week[0].date,
      end: week[week.length - 1].date,
      days: week,
    };
  });
}

const weeklyPeriods = getWeeklyPeriods(DEMO_SERIES);

function TimeSeriesChart({ days, metric, selectedIndex, onSelect }) {
  const width = 800;
  const height = 270;
  const plot = { left: 44, right: 18, top: 20, bottom: 40 };
  const values = days.map(metric.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values.map((value, index) => ({
    x: plot.left + (index / (days.length - 1)) * (width - plot.left - plot.right),
    y:
      plot.top +
      ((maximum - value) / range) * (height - plot.top - plot.bottom),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${plot.left},${height - plot.bottom} ${line} ${
    width - plot.right
  },${height - plot.bottom}`;
  const labels =
    days.length <= 7
      ? [0, Math.floor((days.length - 1) / 2), days.length - 1]
      : [0, 7, 14, 21, days.length - 1];

  return (
    <div className="workspace-series-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${days.length}-day ${metric.label.toLowerCase()} time series. Select a point to inspect a day.`}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = plot.top + fraction * (height - plot.top - plot.bottom);
          const value = maximum - fraction * range;
          return (
            <g key={fraction}>
              <line
                x1={plot.left}
                x2={width - plot.right}
                y1={y}
                y2={y}
                className="workspace-chart-gridline"
              />
              <text x={plot.left - 8} y={y + 4} textAnchor="end" className="workspace-chart-axis">
                {metric.format(value)}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill={metric.color} opacity="0.09" />
        <polyline
          points={line}
          fill="none"
          stroke={metric.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={days[index].date.toISOString()}
            cx={point.x}
            cy={point.y}
            r={selectedIndex === index ? 5.5 : 3}
            fill={selectedIndex === index ? metric.color : "#fff"}
            stroke={metric.color}
            strokeWidth={selectedIndex === index ? 2 : 1.5}
            className="workspace-chart-point"
            role="button"
            tabIndex={0}
            aria-label={`${formatDay(days[index].date, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}: ${metric.format(metric.value(days[index]))} ${metric.unit}`}
            onClick={() => onSelect(index)}
            onFocus={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(index);
              }
            }}
          />
        ))}
        {[...new Set(labels)].map((index) => (
          <text
            key={index}
            x={points[index].x}
            y={height - 12}
            textAnchor="middle"
            className="workspace-chart-axis"
          >
            {formatDay(days[index].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [chartMetric, setChartMetric] = useState("sci");
  const [periodMode, setPeriodMode] = useState("monthly");
  const [selectedDayIndex, setSelectedDayIndex] = useState(29);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(
    Math.max(0, weeklyPeriods.length - 1)
  );
  const hasDemoData = String(dashboard?.dashboard_id ?? id) === "1";
  const demoDays = hasDemoData ? DEMO_SERIES : [];
  const selectedWeek = weeklyPeriods[selectedWeekIndex];
  const periodDays =
    periodMode === "weekly" ? selectedWeek?.days || [] : demoDays;
  const selectedDay = periodDays[selectedDayIndex];
  const periodAverage = (key) =>
    periodDays.length > 0
      ? periodDays.reduce((total, day) => total + day[key], 0) / periodDays.length
      : 0;
  const averageSci = periodAverage("sci");
  const averageEmissions = periodAverage("emissions");
  const averageIntensity = periodAverage("intensity");
  const averageEnergy = periodAverage("energy");
  const periodLabel =
    periodMode === "weekly"
      ? `${selectedWeek?.label || "selected week"} (${formatDay(
          selectedWeek?.start || new Date()
        )}–${formatDay(selectedWeek?.end || new Date())})`
      : "30-day month";
  const activeMetric = metricOptions[chartMetric];

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
                  className="workspace-simulation-button workspace-logbook-button"
                  onClick={() => navigate(`/logbook?dashboard=${encodeURIComponent(id)}`)}
                >
                  Logbook
                </button>
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
            {hasDemoData ? (
              <>
                <div className="workspace-analytics-note">
                  <span className="workspace-demo-dot" />
                  Demo data · 30-day sample · functional unit: API calls
                </div>
                <div className="workspace-detail-grid workspace-analytics-summary">
              <article className="workspace-detail-card">
                <span className="workspace-card-label">SCI</span>
                <div className="workspace-summary-value">
                  <strong className="workspace-detail-metric">{averageSci.toFixed(3)}</strong>
                  <span className="workspace-summary-unit">gCO₂e / API call</span>
                </div>
              </article>
              <article className="workspace-detail-card">
                <span className="workspace-card-label">Emissions</span>
                <div className="workspace-summary-value">
                  <strong className="workspace-detail-metric">{averageEmissions.toFixed(1)}</strong>
                  <span className="workspace-summary-unit">kgCO₂e / day</span>
                </div>
              </article>
              <article className="workspace-detail-card">
                <span className="workspace-card-label">Grid intensity</span>
                <div className="workspace-summary-value">
                  <strong className="workspace-detail-metric">{averageIntensity.toFixed(1)}</strong>
                  <span className="workspace-summary-unit">gCO₂e / kWh</span>
                </div>
              </article>
              <article className="workspace-detail-card">
                <span className="workspace-card-label">Energy consumption</span>
                <div className="workspace-summary-value">
                  <strong className="workspace-detail-metric">{averageEnergy.toFixed(1)}</strong>
                  <span className="workspace-summary-unit">kWh / day</span>
                </div>
              </article>
            </div>
            <section className="workspace-analytics-panel">
              <div className="workspace-analytics-heading">
                <div>
                  <div className="workspace-chart-tabs" role="tablist" aria-label="History period">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={periodMode === "weekly"}
                      className={periodMode === "weekly" ? "is-active" : ""}
                      onClick={() => {
                        setPeriodMode("weekly");
                        setSelectedWeekIndex(weeklyPeriods.length - 1);
                        setSelectedDayIndex(6);
                      }}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={periodMode === "monthly"}
                      className={periodMode === "monthly" ? "is-active" : ""}
                      onClick={() => {
                        setPeriodMode("monthly");
                        setSelectedDayIndex(demoDays.length - 1);
                      }}
                    >
                      Monthly
                    </button>
                  </div>
                  {periodMode === "weekly" ? (
                    <label className="workspace-week-picker">
                      <span className="sr-only">Choose a week</span>
                      <select
                        aria-label="Choose a week"
                        value={selectedWeekIndex}
                        onChange={(event) => {
                          setSelectedWeekIndex(Number(event.target.value));
                          setSelectedDayIndex(6);
                        }}
                      >
                        {weeklyPeriods.map((week, index) => (
                          <option key={week.label} value={index}>
                            {week.label} · {formatDay(week.start)}–{formatDay(week.end)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <>
                      <h2>Impact over time</h2>
                      <p>Select any point to inspect that day’s measurements.</p>
                      <span className="workspace-chart-unit">{activeMetric.unit}</span>
                    </>
                  )}
                </div>
                <div className="workspace-chart-tabs" role="tablist" aria-label="Chart metric">
                  {Object.entries(metricOptions).map(([key, metric]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={chartMetric === key}
                      className={chartMetric === key ? "is-active" : ""}
                      onClick={() => setChartMetric(key)}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>
              <TimeSeriesChart
                days={periodDays}
                metric={activeMetric}
                selectedIndex={selectedDayIndex}
                onSelect={setSelectedDayIndex}
              />
              <div className="workspace-selected-day">
                <div>
                  <span className="workspace-card-label">SELECTED DAY</span>
                  <strong>{formatDay(selectedDay.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}</strong>
                </div>
                <span className="workspace-selected-sci">
                  {selectedDay.sci.toFixed(6)}
                  <small>gCO₂e / API call</small>
                </span>
                <span>{selectedDay.emissions.toFixed(1)} kgCO₂e</span>
                <span>{selectedDay.intensity.toFixed(1)} gCO₂e/kWh</span>
                <span>{selectedDay.energy.toFixed(1)} kWh</span>
                <span>{selectedDay.apiCalls.toLocaleString()} API calls</span>
              </div>
            </section>

            <SimulationPanel
              days={periodDays}
              periodLabel={periodLabel}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
            />

            <details className="workspace-daily-details">
              <summary>View daily SCI for all 30 days</summary>
              <div className="workspace-daily-table-wrap">
                <table className="workspace-daily-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>SCI (gCO₂e / API call)</th>
                      <th>Emissions (kgCO₂e)</th>
                      <th>Grid (gCO₂e/kWh)</th>
                      <th>Energy (kWh)</th>
                      <th>API calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoDays.map((day, index) => (
                      <tr
                        key={day.date.toISOString()}
                        className={
                          periodMode === "monthly" && index === selectedDayIndex
                            ? "is-selected"
                            : ""
                        }
                        onClick={() => {
                          setPeriodMode("monthly");
                          setSelectedDayIndex(index);
                        }}
                      >
                        <td>{formatDay(day.date, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}</td>
                        <td>{day.sci.toFixed(6)}</td>
                        <td>{day.emissions.toFixed(1)}</td>
                        <td>{day.intensity.toFixed(1)}</td>
                        <td>{day.energy.toFixed(1)}</td>
                        <td>{day.apiCalls.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
              </>
            ) : (
              <section className="workspace-detail-empty">
                <span className="workspace-detail-chart-icon" aria-hidden="true">⌁</span>
                <h2>No telemetry data yet</h2>
                <p>
                  This workspace has no analytics data. The current demo data is
                  linked only to dashboard 1 (fe).
                </p>
              </section>
            )}
          </section>
        ) : null}
      </div>

    </main>
  );
}
