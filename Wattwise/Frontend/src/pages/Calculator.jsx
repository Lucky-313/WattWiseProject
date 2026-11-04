export default function Calculator() {
  return (
    <section>
      <h2>SCI Calculator</h2>
      <p>SCI = ((E * I) + M) / R</p>

      <div>
        <div>
          <label>
            Energy consumed, E (kWh):{" "}
            <input type="number" />
          </label>
        </div>
        <div>
          <label>
            Grid carbon intensity, I (gCO2e/kWh):{" "}
            <input type="number" />
          </label>
        </div>
        <div>
          <label>
            Embodied emissions, M (gCO2e):{" "}
            <input type="number" />
          </label>
        </div>
        <div>
          <label>
            Functional unit, R (e.g. API calls):{" "}
            <input type="number" />
          </label>
        </div>
      </div>

      <div>
        <button>Calculate</button> <button type="reset">Clear</button>
      </div>

      <h3>Result</h3>
      <p>SCI score: --</p>
    </section>
  );
}
