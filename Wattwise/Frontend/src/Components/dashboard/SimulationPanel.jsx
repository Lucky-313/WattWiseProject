import { useMemo, useState } from "react";
import { DEMO_SERIES } from "../../services/demoTelemetry.js";

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
    variableFields.map(({ key }) => [key, average(days, key).toFixed(1)])
  );
}

function formatDate(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en", options).format(date);
}

function formatInputOnBlur(key, inputs, setInputs) {
  const rawValue = inputs[key];
  if (rawValue.trim() === "") return;

  const value = Number(rawValue);
  const field = variableFields.find((item) => item.key === key);
  const minimum = Number(field.min);
  if (!Number.isFinite(value) || value < minimum) return;

  let roundedValue = Number(value.toFixed(1));
  if (roundedValue < minimum) {
    roundedValue = Math.ceil(minimum * 10) / 10;
  }
  setInputs((previous) => ({ ...previous, [key]: roundedValue.toFixed(1) }));
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

function SimulationChart({ days, scenarioDays, selectedIndex, onSelect }) {
  const width = 800;
  const height = 300;
  const plot = { left: 62, right: 20, top: 24, bottom: 42 };
  const baselineValues = days.map((day) => day.sci);
  const scenarioValues = scenarioDays.map((day) => day.sci);
  const mean =
    scenarioValues.reduce((total, value) => total + value, 0) /
    scenarioValues.length;
  const minimum = Math.min(...baselineValues, ...scenarioValues, mean);
  const maximum = Math.max(...baselineValues, ...scenarioValues, mean);
  const padding = Math.max((maximum - minimum) * 0.18, maximum * 0.06, 0.000001);
  const lower = Math.max(0, minimum - padding);
  const upper = maximum + padding;
  const range = upper - lower || 1;
  const x = (index) =>
    plot.left +
    (index / (scenarioDays.length - 1)) * (width - plot.left - plot.right);
  const y = (value) =>
    plot.top + ((upper - value) / range) * (height - plot.top - plot.bottom);
  const baselineLine = baselineValues
    .map((value, index) => `${x(index)},${y(value)}`)
    .join(" ");
  const scenarioLine = scenarioValues
    .map((value, index) => `${x(index)},${y(value)}`)
    .join(" ");
  const area = `${x(0)},${height - plot.bottom} ${scenarioLine} ${
    x(scenarioDays.length - 1)
  },${height - plot.bottom}`;
  const dateLabels =
    days.length <= 7
      ? [0, Math.floor((days.length - 1) / 2), days.length - 1]
      : [0, 7, 14, 21, days.length - 1];
  const ticks = [0, 0.5, 1];

  return (
    <div className="workspace-series-chart workspace-simulation-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Interactive ${days.length}-day SCI simulation chart. The blue line is your scenario and the gray line is the original.`}
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
                {value.toFixed(3)}
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
            })}: simulated SCI ${day.sci.toFixed(3)} grams of carbon dioxide equivalent per API call`}
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
        {[...new Set(dateLabels)].map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 13}
            textAnchor="middle"
            className="workspace-chart-axis"
          >
            {formatDate(days[index].date)}
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

export default function SimulationPanel({ days, periodLabel, selectedIndex, onSelect }) {
  const [inputs, setInputs] = useState(() => makeDefaultInputs(DEMO_SERIES));
  const baseline = useMemo(
    () => {
      const defaults = makeDefaultInputs(DEMO_SERIES);
      return Object.fromEntries(
        variableFields.map(({ key }) => [key, Number(defaults[key])])
      );
    },
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
    ? buildScenario(days, parsedInputs, baseline)
    : [];
  const averageSci = validInputs ? average(scenarioDays, "sci") : null;
  const selectedDay = scenarioDays[selectedIndex];

  function updateInput(key, value) {
    setInputs((previous) => ({ ...previous, [key]: value }));
  }

  function resetSimulation() {
    setInputs(makeDefaultInputs(DEMO_SERIES));
  }

  return (
    <section className="workspace-simulation-section workspace-simulation-page">
      <div className="workspace-detail-heading">
        <div>
          <span className="workspace-eyebrow">WHAT-IF SIMULATION</span>
          <h2>Simulate impact</h2>
          <p>Adjust daily averages and compare the SCI trend for this {periodLabel}.</p>
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
            <span className="workspace-card-label">
              {periodLabel.toUpperCase()} SCENARIO
            </span>
            <h2>SCI over time</h2>
            <p>Daily SCI per API call, recalculated from your scenario values.</p>
          </div>
        </div>
        {validInputs && (
          <SimulationChart
            days={days}
            scenarioDays={scenarioDays}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
          />
        )}
      </section>

      <section className="workspace-simulation-metrics" aria-label="Simulation variables">
        <article className="workspace-simulation-score">
          <span className="workspace-card-label">SIMULATED AVERAGE SCI</span>
          <strong>{averageSci == null ? "—" : averageSci.toFixed(3)}</strong>
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
              onBlur={() => formatInputOnBlur(field.key, inputs, setInputs)}
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
            <strong>
              {formatDate(selectedDay.date, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>
          </div>
          <div className="workspace-simulation-comparison">
            <div className="workspace-simulation-comparison-value workspace-simulation-original">
              <span>Original SCI</span>
              <strong>{days[selectedIndex].sci.toFixed(3)}</strong>
            </div>
            <div className="workspace-simulation-comparison-value workspace-simulation-scenario">
              <span>Simulated SCI</span>
              <strong>{selectedDay.sci.toFixed(3)}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
