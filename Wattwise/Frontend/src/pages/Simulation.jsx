import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ACCESS_TOKEN_KEY, getDashboard } from "../services/api.js";
import { DEMO_SERIES } from "../services/demoTelemetry.js";

const variableFields = [
  {
    key: "energy",
    label: "Energy consumption",
    unit: "kWh / day",
    step: "0.1",
    min: "0.01",
  },
  {
    key: "intensity",
    label: "Grid carbon intensity",
    unit: "gCO₂e / kWh",
    step: "1",
    min: "0.01",
  },
  {
    key: "embodied",
    label: "Embodied emissions",
    unit: "gCO₂e / day",
    step: "1",
    min: "0",
  },
  {
    key: "apiCalls",
    label: "API calls",
    unit: "calls / day",
    step: "100",
    min: "1",
  },
];

function average(days, key) {
  return days.reduce((total, day) => total + day[key], 0) / days.length;
}

function makeDefaultInputs(days) {
  return Object.fromEntries(
    variableFields.map(({ key }) => [key, String(average(days, key))])
  );
}

function formatDate(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(date);
}

function buildScenario(days, inputs, baseline) {
  const scale = Object.fromEntries(
    variableFields.map(({ key }) => [key, inputs[key] / baseline[key]])
  );

  return days.map((day) => {
    const energy = day.energy * scale.energy;
    const intensity = day.intensity * scale.intensity;
    const embodied = day.embodied * scale.embodied;
    const apiCalls = day.apiCalls * scale.apiCalls;
    return {
      ...day,
      energy,
      intensity,
      embodied,
      apiCalls,
      sci: (energy * intensity + embodied) / apiCalls,
    };
  });
}

function SimulationChart({ baselineDays, scenarioDays, selectedIndex, onSelect }) {
  const width = 800;
  const height = 300;
  const plot = { left: 62, right: 20, top: 24, bottom: 42 };
  const baseValues = baselineDays.map((day) => day.sci);
  const scenarioValues = scenarioDays.map((day) => day.sci);
  const mean = scenarioValues.reduce((total, value) => total + value, 0) / scenarioValues.length;
  const minimum = Math.min(...baseValues, ...scenarioValues, mean);
  const maximum = Math.max(...baseValues, ...scenarioValues, mean);
  const padding = Math.max((maximum - minimum) * 0.18, maximum * 0.06, 0.000001);
  const lower = Math.max(0, minimum - padding);
  const upper = maximum + padding;
  const range = upper - lower || 1;
  const x = (index) =>
    plot.left + (index / (scenarioDays.length - 1)) * (width - plot.left - plot.right);
  const y = (value) =>
    plot.top + ((upper - value) / range) * (height - plot.top - plot.bottom);
  const baselineLine = baseValues.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const scenarioLine = scenarioValues
    .map((value, index) => `${x(index)},${y(value)}`)
    .join(" ");
  const area = `${x(0)},${height - plot.bottom} ${scenarioLine} ${
    x(scenarioDays.length - 1)
  },${height - plot.bottom}`;
  const dateLabels = [0, 7, 14, 21, 29];
  const ticks = [0, 0.5, 1];

  return (
    <div className="workspace-series-chart workspace-simulation-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Interactive 30-day SCI simulation chart. The blue line is your scenario and the gray line is the original."
      >
        {ticks.map((fraction) => {
          const value = upper - fraction * range;
          return (
            <g key={fraction}>
              <line
                x1={plot.left}
                x2={width - plot.right}
                y1={y(value)}
                y2={y(value)}
                className="workspace-chart-gridline"
              />
              <text
                x={plot.left - 9}
                y={y(value) + 4}
                textAnchor="end"
                className="workspace-chart-axis"
              >
                {value.toFixed(5)}
              </text>
            </g>
          );
        })}
        <line
          x1={plot.left}
          x2={width - plot.right}
          y1={y(mean)}
          y2={y(mean)}
          className="workspace-simulation-average-line"
        />
        <polygon points={area} fill="#0284c7" opacity="0.08" />
        <polyline
          points={baselineLine}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
        <polyline
          points={scenarioLine}
          fill="none"
          stroke="#0284c7"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {scenarioDays.map((day, index) => (
          <circle
            key={day.date.toISOString()}
            cx={x(index)}
            cy={y(day.sci)}
            r={selectedIndex === index ? 5.5 : 3}
            fill={selectedIndex === index ? "#0284c7" : "#fff"}
            stroke="#0284c7"
            strokeWidth={selectedIndex === index ? 2 : 1.5}
            className="workspace-chart-point"
            role="button"
            tabIndex={0}
            aria-label={`${formatDate(day.date, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}: simulated SCI ${day.sci.toFixed(6)} grams of carbon dioxide equivalent per API call`}
            onClick={() => onSelect(index)}
            onFocus={() => onSelect(index)}
            onMouseEnter={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(index);
              }
            }}
          />
        ))}
        {dateLabels.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 13}
            textAnchor="middle"
            className="workspace-chart-axis"
          >
            {formatDate(scenarioDays[index].date)}
          </text>
        ))}
      </svg>
      <div className="workspace-simulation-legend">
        <span><i className="workspace-legend-scenario" /> Simulated SCI</span>
        <span><i className="workspace-legend-baseline" /> Original SCI</span>
        <span><i className="workspace-legend-average" /> Simulated average</span>
      </div>
    </div>
  );
}

export default function Simulation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState(() => makeDefaultInputs(DEMO_SERIES));
  const [selectedIndex, setSelectedIndex] = useState(DEMO_SERIES.length - 1);
  const baseline = useMemo(
    () => Object.fromEntries(variableFields.map(({ key }) => [key, average(DEMO_SERIES, key)])),
    []
  );
  const parsedInputs = Object.fromEntries(
    variableFields.map(({ key }) => [key, Number(inputs[key])])
  );
  const validInputs = variableFields.every(({ key }) => {
    const value = parsedInputs[key];
    return Number.isFinite(value) && value >= (key === "embodied" ? 0 : Number.EPSILON);
  });
  const scenarioDays = validInputs
    ? buildScenario(DEMO_SERIES, parsedInputs, baseline)
    : [];
  const averageSci = validInputs
    ? average(scenarioDays, "sci")
    : null;
  const hasData = String(dashboard?.dashboard_id) === "1" && DEMO_SERIES.length > 0;
  const selectedDay = scenarioDays[selectedIndex];

  useEffect(() => {
    if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      navigate("/", { replace: true });
      return undefined;
    }

    let active = true;
    getDashboard(id)
      .then((result) => {
        if (active) {
          setDashboard(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (!active) return;
        if (!sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
          navigate("/", { replace: true });
        } else if (requestError.message.includes("Unlock this dashboard")) {
          navigate(`/dashboard/${encodeURIComponent(id)}`, { replace: true });
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

  function updateInput(key, value) {
    setInputs((previous) => ({ ...previous, [key]: value }));
  }

  function resetSimulation() {
    setInputs(makeDefaultInputs(DEMO_SERIES));
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
            {dashboard && (
              <>
                <span className="workspace-header-divider" />
                <a
                  className="workspace-header-label"
                  href={`/dashboard/${encodeURIComponent(id)}`}
                >
                  {dashboard.name}
                </a>
              </>
            )}
          </div>
          <button type="button" className="workspace-logout" onClick={logout}>
            Log out
          </button>
        </header>

        {loading ? (
          <div className="workspace-detail-state">
            <span className="workspace-spinner" /> Loading workspace data…
          </div>
        ) : error ? (
          <section className="workspace-detail-state workspace-detail-error">
            <h1>Simulation unavailable</h1>
            <p>{error}</p>
            <button type="button" className="workspace-secondary-button" onClick={() => navigate("/home")}>
              Back to workspaces
            </button>
          </section>
        ) : hasData ? (
          <section className="workspace-detail workspace-simulation-page">
            <button
              type="button"
              className="workspace-back-link"
              onClick={() => navigate(`/dashboard/${encodeURIComponent(id)}`)}
            >
              ← Back to {dashboard.name}
            </button>
            <div className="workspace-detail-heading">
              <div>
                <span className="workspace-eyebrow">WHAT-IF SIMULATION</span>
                <h1>{dashboard.name} · SCI scenario</h1>
                <p>Adjust daily averages and see how the 30-day SCI trend could change.</p>
              </div>
              <button
                type="button"
                className="workspace-secondary-button workspace-simulation-reset"
                onClick={resetSimulation}
              >
                Reset to baseline
              </button>
            </div>

            <div className="workspace-simulation-notice">
              <span className="workspace-demo-dot" />
              Simulation only · changes are not saved to your dashboard or backend.
            </div>

            <section className="workspace-analytics-panel workspace-simulation-panel">
              <div className="workspace-analytics-heading">
                <div>
                  <span className="workspace-card-label">30-DAY TREND</span>
                  <h2>SCI over time</h2>
                  <p>Daily SCI per API call, recalculated from your scenario values.</p>
                </div>
              </div>
              {validInputs && (
                <>
                  <SimulationChart
                    baselineDays={DEMO_SERIES}
                    scenarioDays={scenarioDays}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                  />
                </>
              )}
            </section>
            <section className="workspace-simulation-metrics" aria-label="Simulation variables">
              <article className="workspace-simulation-score">
                <span className="workspace-card-label">SIMULATED AVERAGE SCI</span>
                <strong>{averageSci == null ? "—" : averageSci.toFixed(6)}</strong>
                <span>gCO₂e per API call</span>
                <small>SCI = ((energy × grid intensity) + embodied emissions) ÷ API calls</small>
              </article>
              {variableFields.map((field) => (
                <label key={field.key} className="workspace-simulation-field">
                  <span>{field.label}</span>
                  <input
                    type="number"
                    min={field.min}
                    step={field.step}
                    inputMode="decimal"
                    value={inputs[field.key]}
                    onChange={(event) => updateInput(field.key, event.target.value)}
                    aria-label={`${field.label}, ${field.unit}`}
                  />
                  <small>{field.unit}</small>
                </label>
              ))}
            </section>
            {!validInputs && (
              <p className="workspace-simulation-validation" role="alert">
                Enter a valid non-negative value for each variable. Energy, intensity,
                and API calls must be greater than zero.
              </p>
            )}
            {selectedDay && (
              <div className="workspace-selected-day workspace-simulation-selected">
                <div>
                  <span className="workspace-card-label">SELECTED DAY</span>
                  <strong>{formatDate(selectedDay.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}</strong>
                </div>
                <span className="workspace-selected-sci">
                  {selectedDay.sci.toFixed(6)}
                  <small>simulated gCO₂e / API call</small>
                </span>
                <span>Original {DEMO_SERIES[selectedIndex].sci.toFixed(6)}</span>
              </div>
            )}
          </section>
        ) : (
          <section className="workspace-detail-empty workspace-simulation-empty">
            <span className="workspace-detail-chart-icon" aria-hidden="true">⌁</span>
            <h2>No data available to simulate</h2>
            <p>This workspace needs at least one day of telemetry before a simulation can be run.</p>
            <button
              type="button"
              className="workspace-secondary-button"
              onClick={() => navigate(`/dashboard/${encodeURIComponent(id)}`)}
            >
              Back to dashboard
            </button>
          </section>
        )}
      </div>
    </main>
  );
}