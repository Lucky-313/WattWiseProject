export default function Logbook() {
  return (
    <section>
      <h2>Logbook</h2>

      <h3>SLA Limit</h3>
      <div>
        <label>
          Limit (gCO2e per 100 calls):{" "}
          <input type="number" />
        </label>{" "}
        <button>Set Limit</button>
      </div>

      <h3>Entries</h3>
      <table border="1" cellPadding="4">
        <thead>
          <tr>
            <th>Date</th>
            <th>Metric</th>
            <th>Limit</th>
            <th>Actual</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="5">No entries yet.</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
