import { useMemo, useState } from "react";

const initialValues = {
  energy: "12.5",
  intensity: "240",
  embodied: "220",
  apiCalls: "82000",
};

const fields = [
  {
    key: "energy",
    label: "Energy consumption",
    unit: "kWh",
    description: "Energy used by the software system for this measurement period.",
    min: "0.001",
    step: "0.1",
  },
  {
    key: "intensity",
    label: "Grid carbon intensity",
    unit: "gCO₂e / kWh",
    description: "Carbon intensity of the electricity used during the period.",
    min: "0",
    step: "1",
  },
  {
    key: "embodied",
    label: "Embodied emissions",
    unit: "gCO₂e",
    description: "Allocated embodied emissions for the infrastructure in this period.",
    min: "0",
    step: "1",
  },
  {
    key: "apiCalls",
    label: "API calls",
    unit: "calls",
    description: "Functional unit used to normalize the SCI score.",
    min: "1",
    step: "1",
  },
];

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en", { maximumFractionDigits }).format(value);
}

export default function Calculator() {
  const [values, setValues] = useState(initialValues);
  const parsed = Object.fromEntries(
    Object.keys(initialValues).map((key) => [key, Number(values[key])])
  );
  const errors = {
    energy:
      !Number.isFinite(parsed.energy) || parsed.energy <= 0
        ? "Enter energy greater than zero."
        : "",
    intensity:
      !Number.isFinite(parsed.intensity) || parsed.intensity < 0
        ? "Enter a non-negative grid intensity."
        : "",
    embodied:
      !Number.isFinite(parsed.embodied) || parsed.embodied < 0
        ? "Enter non-negative embodied emissions."
        : "",
    apiCalls:
      !Number.isFinite(parsed.apiCalls) || parsed.apiCalls <= 0
        ? "Enter API calls greater than zero."
        : "",
  };
  const valid = Object.values(errors).every((error) => !error);
  const results = useMemo(() => {
    if (!valid) return null;
    const operational = parsed.energy * parsed.intensity;
    const total = operational + parsed.embodied;
    return {
      operational,
      total,
      sci: total / parsed.apiCalls,
    };
  }, [valid, parsed.energy, parsed.intensity, parsed.embodied, parsed.apiCalls]);

  function updateField(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function useExample() {
    setValues(initialValues);
  }

  return (
    <main className="sci-calculator-page">
      <div className="sci-calculator-shell">
        <header className="sci-calculator-heading">
          <span className="sci-calculator-eyebrow">WATTWISE · ENGINEERING TOOL</span>
          <h1>SCI calculator</h1>
          <p>
            Estimate the carbon intensity of your software per API call using the
            ISO 21031-style SCI equation.
          </p>
        </header>

        <div className="sci-calculator-grid">
          <section className="sci-calculator-card">
            <div className="sci-calculator-card-heading">
              <div>
                <h2>Measurement inputs</h2>
                <p>Enter values for the same measurement period.</p>
              </div>
              <button
                type="button"
                className="sci-calculator-example"
                onClick={useExample}
              >
                Load example
              </button>
            </div>

            <div className="sci-calculator-fields">
              {fields.map((field) => (
                <label key={field.key} className="sci-calculator-field">
                  <span className="sci-calculator-field-title">{field.label}</span>
                  <span className="sci-calculator-input-wrap">
                    <input
                      type="number"
                      min={field.min}
                      step={field.step}
                      inputMode="decimal"
                      value={values[field.key]}
                      aria-label={field.label}
                      aria-invalid={Boolean(errors[field.key])}
                      aria-describedby={`${field.key}-description ${field.key}-error`}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                    <span>{field.unit}</span>
                  </span>
                  <small id={`${field.key}-description`}>{field.description}</small>
                  {errors[field.key] && (
                    <span className="sci-calculator-error" id={`${field.key}-error`} role="alert">
                      {errors[field.key]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>

          <section className="sci-calculator-results" aria-live="polite">
            <div className="sci-calculator-result-primary">
              <span className="sci-calculator-eyebrow">SOFTWARE CARBON INTENSITY</span>
              <strong>{results ? formatNumber(results.sci, 6) : "—"}</strong>
              <span>gCO₂e per API call</span>
            </div>
            <div className="sci-calculator-result-row">
              <span>Operational emissions</span>
              <strong>
                {results ? `${formatNumber(results.operational)} gCO₂e` : "—"}
              </strong>
            </div>
            <div className="sci-calculator-result-row">
              <span>Total emissions</span>
              <strong>{results ? `${formatNumber(results.total)} gCO₂e` : "—"}</strong>
            </div>
            <div className="sci-calculator-result-row">
              <span>Functional unit</span>
              <strong>API calls</strong>
            </div>
          </section>
        </div>

        <section className="sci-calculator-method">
          <span className="sci-calculator-eyebrow">HOW IT IS CALCULATED</span>
          <div className="sci-calculator-equation">
            <span>SCI</span>
            <span>=</span>
            <span className="sci-calculator-fraction">
              <span>(Energy × Grid intensity) + Embodied emissions</span>
              <span>API calls</span>
            </span>
          </div>
          <p>
            Energy (kWh) × grid intensity (gCO₂e/kWh) gives operational emissions
            in grams of CO₂e. Embodied emissions are added before dividing by API
            calls. This is an estimate based on the inputs provided, not a
            measurement of live infrastructure.
          </p>
        </section>
      </div>
    </main>
  );
}
