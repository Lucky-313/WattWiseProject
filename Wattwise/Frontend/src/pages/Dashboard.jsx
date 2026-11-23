import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ACCESS_TOKEN_KEY,
  getDashboard,
  getDashboardMeasurements,
  verifyDashboardPasscode,
} from "../services/api.js";
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

const FUNCTIONAL_UNIT_TYPES = [
  { value: "api_calls", label: "API Calls", singular: "API Call" },
  { value: "active_users", label: "Active Users", singular: "Active User" },
  { value: "transactions", label: "Transactions", singular: "Transaction" },
  { value: "requests", label: "Requests", singular: "Request" },
];

function formatDay(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(date);
}

function parseLocalDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeeklyPeriods(days, includePartialWeek = false) {
  const weekCount = includePartialWeek
    ? Math.ceil(days.length / 7)
    : Math.min(4, Math.floor(days.length / 7));
  return Array.from({ length: weekCount }, (_, index) => {
    const startIndex = index * 7;
    const week = days.slice(startIndex, startIndex + 7);
    return {
      label: `Week ${index + 1}`,
      start: week[0].date,
      end: week[week.length - 1].date,
      startIndex,
      days: week,
    };
  });
}

function formatFunctionalUnitCount(value) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

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
  const [measurementsLoading, setMeasurementsLoading] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [chartMetric, setChartMetric] = useState("sci");
  const [periodMode, setPeriodMode] = useState("monthly");
  const [selectedDayIndex, setSelectedDayIndex] = useState(29);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [uploadedDays, setUploadedDays] = useState([]);
  const [functionalUnitType, setFunctionalUnitType] = useState("api_calls");
  const hasCsvData = Boolean(dashboard?.has_csv);
  const hasDemoData =
    String(dashboard?.dashboard_id ?? id) === "1" && !hasCsvData;
  const dashboardDays = uploadedDays.length
    ? uploadedDays
    : hasDemoData
      ? DEMO_SERIES
      : uploadedDays;
  const weeklyPeriods = useMemo(
    () => getWeeklyPeriods(dashboardDays, hasCsvData),
    [dashboardDays, hasCsvData]
  );
  const selectedWeek = weeklyPeriods[selectedWeekIndex];
  const periodDays =
    periodMode === "weekly" ? selectedWeek?.days || [] : dashboardDays;
  const selectedDay = periodDays[selectedDayIndex];
  const periodTotals = useMemo(() => {
    const totalEmissions = periodDays.reduce(
      (total, day) => total + day.emissions,
      0
    );
    const totalEnergy = periodDays.reduce(
      (total, day) => total + day.energy,
      0
    );
    const totalFunctionalUnits = periodDays.reduce(
      (total, day) => total + day.apiCalls,
      0
    );
    const weightedIntensity = periodDays.reduce(
      (total, day) => total + day.intensity * day.energy,
      0
    );
    return {
      emissions: totalEmissions,
      energy: totalEnergy,
      functionalUnits: totalFunctionalUnits,
      intensity:
        totalEnergy > 0
          ? weightedIntensity / totalEnergy
          : periodDays.length
            ? periodDays.reduce((total, day) => total + day.intensity, 0) /
              periodDays.length
            : 0,
      sci:
        totalFunctionalUnits > 0
          ? (totalEmissions * 1000) / totalFunctionalUnits
          : 0,
    };
  }, [periodDays]);
  const functionalUnit =
    FUNCTIONAL_UNIT_TYPES.find((unit) => unit.value === functionalUnitType) ||
    FUNCTIONAL_UNIT_TYPES[0];
  const periodLabel =
    periodMode === "weekly"
      ? `${selectedWeek?.label || "selected week"} (${formatDay(
          selectedWeek?.start || new Date()
        )}–${formatDay(selectedWeek?.end || new Date())})`
      : `${dashboardDays.length || 30}-day month`;
  const activeMetric = {
    ...metricOptions[chartMetric],
    unit:
      chartMetric === "sci"
        ? `gCO₂e / ${functionalUnit.singular}`
        : metricOptions[chartMetric].unit,
  };

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    setLoading(true);
    setDashboard(null);
    setUploadedDays([]);
    setNeedsUnlock(false);
    setError("");
    setPeriodMode("monthly");
    setFunctionalUnitType("api_calls");
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

  useEffect(() => {
    if (!dashboard?.has_csv) {
      setUploadedDays([]);
      setMeasurementsLoading(false);
      return undefined;
    }

    let active = true;
    setMeasurementsLoading(true);
    getDashboardMeasurements(id)
      .then((result) => {
        if (!Array.isArray(result.measurements)) {
          throw new Error("The dashboard returned invalid measurement data.");
        }
        const measurements = result.measurements.map((item) => {
          const date = parseLocalDate(item.date);
          const day = {
            date,
            energy: Number(item.energy),
            intensity: Number(item.intensity),
            embodied: Number(item.embodied),
            apiCalls: Number(item.functionalUnitCount ?? item.apiCalls),
            sci: Number(item.sci),
            emissions: Number(item.emissions),
          };
          if (
            Number.isNaN(date.getTime()) ||
            Object.values(day)
              .filter((value) => typeof value === "number")
              .some((value) => !Number.isFinite(value))
          ) {
            throw new Error("The dashboard returned invalid measurement data.");
          }
          return day;
        });
        if (active) setUploadedDays(measurements);
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
        if (active) setMeasurementsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dashboard?.has_csv, id, navigate]);

  useEffect(() => {
    if (!dashboardDays.length) return;
    setSelectedDayIndex(dashboardDays.length - 1);
    setSelectedWeekIndex(Math.max(0, weeklyPeriods.length - 1));
  }, [id, dashboardDays.length, weeklyPeriods.length]);

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
            {dashboardDays.length > 0 ? (
              <>
                <div className="workspace-analytics-note">
                  <span className="workspace-demo-dot" />
                  {hasDemoData
                    ? "Demo data · 30-day sample"
                    : `CSV data · ${dashboardDays.length} daily rows`}
                  {" · "}functional unit: {functionalUnit.label}
                </div>
                <div className="workspace-detail-grid workspace-analytics-summary">
                  <article className="workspace-detail-card">
                    <span className="workspace-card-label">SCI</span>
                    <div className="workspace-summary-value">
                      <strong className="workspace-detail-metric">
                        {periodTotals.sci.toFixed(3)}
                      </strong>
                      <span className="workspace-summary-unit">
                        gCO₂e / {functionalUnit.singular}
                      </span>
                    </div>
                  </article>
                  <article className="workspace-detail-card">
                    <span className="workspace-card-label">Emissions</span>
                    <div className="workspace-summary-value">
                      <strong className="workspace-detail-metric">
                        {periodTotals.emissions.toFixed(1)}
                      </strong>
                      <span className="workspace-summary-unit">kgCO₂e total</span>
                    </div>
                  </article>
                  <article className="workspace-detail-card">
                    <span className="workspace-card-label">Grid intensity</span>
                    <div className="workspace-summary-value">
                      <strong className="workspace-detail-metric">
                        {periodTotals.intensity.toFixed(1)}
                      </strong>
                      <span className="workspace-summary-unit">gCO₂e / kWh</span>
                    </div>
                  </article>
                  <article className="workspace-detail-card">
                    <span className="workspace-card-label">Energy consumption</span>
                    <div className="workspace-summary-value">
                      <strong className="workspace-detail-metric">
                        {periodTotals.energy.toFixed(1)}
                      </strong>
                      <span className="workspace-summary-unit">kWh total</span>
                    </div>
                  </article>
                  <article className="workspace-detail-card">
                    <span className="workspace-card-label">Functional units</span>
                    <div className="workspace-summary-value">
                      <strong className="workspace-detail-metric">
                        {formatFunctionalUnitCount(periodTotals.functionalUnits)}
                      </strong>
                      <span className="workspace-summary-unit">
                        {functionalUnit.label} total
                      </span>
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
                        const lastWeek = weeklyPeriods[weeklyPeriods.length - 1];
                        const lastWeekIndex = weeklyPeriods.length - 1;
                        setSelectedWeekIndex(lastWeekIndex);
                        setSelectedDayIndex(
                          Math.max(0, (lastWeek?.days.length || 1) - 1)
                        );
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
                        setSelectedDayIndex(dashboardDays.length - 1);
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
                          const weekIndex = Number(event.target.value);
                          const week = weeklyPeriods[weekIndex];
                          setSelectedWeekIndex(weekIndex);
                          setSelectedDayIndex(
                            Math.max(0, (week?.days.length || 1) - 1)
                          );
                        }}
                      >
                        {weeklyPeriods.map((week, index) => (
                          <option key={week.label} value={index}>
                            {week.label} · {formatDay(week.start)}–{formatDay(week.end)}
                          </option>
                        ))}
                      </select>
                      <span className="workspace-chart-unit">{activeMetric.unit}</span>
                    </label>
                  ) : (
                    <>
                      <h2>Impact over time</h2>
                      <p>Select any point to inspect that day’s measurements.</p>
                      <span className="workspace-chart-unit">{activeMetric.unit}</span>
                    </>
                  )}
                </div>
                <div className="workspace-chart-control-group">
                  <label className="workspace-functional-unit">
                    <span>Functional unit</span>
                    <select
                      aria-label="Functional unit type"
                      value={functionalUnitType}
                      onChange={(event) =>
                        setFunctionalUnitType(event.target.value)
                      }
                    >
                      {FUNCTIONAL_UNIT_TYPES.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <small>gCO₂e / {functionalUnit.singular}</small>
                </span>
                <span>{selectedDay.emissions.toFixed(1)} kgCO₂e</span>
                <span>{selectedDay.intensity.toFixed(1)} gCO₂e/kWh</span>
                <span>{selectedDay.energy.toFixed(1)} kWh</span>
                <span>
                  {formatFunctionalUnitCount(selectedDay.apiCalls)}{" "}
                  {functionalUnit.label}
                </span>
              </div>
            </section>

            <SimulationPanel
              days={periodDays}
              periodLabel={periodLabel}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
              functionalUnitLabel={functionalUnit.singular}
              functionalUnitPlural={functionalUnit.label}
            />

            <details className="workspace-daily-details">
              <summary>View daily SCI for all {dashboardDays.length} days</summary>
              <div className="workspace-daily-table-wrap">
                <table className="workspace-daily-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>SCI (gCO₂e / {functionalUnit.singular})</th>
                      <th>Emissions (kgCO₂e)</th>
                      <th>Grid (gCO₂e/kWh)</th>
                      <th>Energy (kWh)</th>
                      <th>{functionalUnit.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardDays.map((day, index) => (
                      <tr
                        key={day.date.toISOString()}
                        className={
                          (periodMode === "monthly" &&
                            index === selectedDayIndex) ||
                          (periodMode === "weekly" &&
                            index ===
                              (selectedWeek?.startIndex ?? 0) +
                                selectedDayIndex)
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
                        <td>{formatFunctionalUnitCount(day.apiCalls)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
              </>
            ) : measurementsLoading ? (
              <section
                className="workspace-detail-empty"
                role="status"
                aria-busy="true"
              >
                <span className="workspace-spinner" aria-hidden="true" />
                <h2>Loading CSV measurements</h2>
                <p>Retrieving the processed daily data for this dashboard.</p>
              </section>
            ) : (
              <section className="workspace-detail-empty">
                <span className="workspace-detail-chart-icon" aria-hidden="true">⌁</span>
                <h2>No telemetry data yet</h2>
                <p>
                  Upload a valid 30- or 31-day CSV to populate this dashboard’s
                  daily, weekly, and monthly analytics.
                </p>
                <button
                  type="button"
                  className="workspace-secondary-button"
                  onClick={() =>
                    navigate(`/home?settings=${encodeURIComponent(id)}`)
                  }
                >
                  Upload CSV
                </button>
              </section>
            )}
          </section>
        ) : null}
      </div>

    </main>
  );
}
