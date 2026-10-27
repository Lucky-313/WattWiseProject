export default function Dashboard() {
  return (
    <section>
      <h2>Dashboard</h2>

      <div>
        <button>Add Dashboard</button> <button>Refresh</button>
      </div>

      <h3>SCI Score</h3>
      <p>-- gCO2e per functional unit</p>

      <h3>Energy (kWh)</h3>
      <p>[Graph placeholder]</p>

      <h3>Carbon Intensity (gCO2e/kWh)</h3>
      <p>[Graph placeholder]</p>

      <h3>Recent Logbook Entries</h3>
      <p>No entries yet.</p>
    </section>
  );
}
