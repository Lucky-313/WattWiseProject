
const metrics = [
  { label: "Energy Consumption", unit: "kWh", icon: "⚡" },
  { label: "Carbon Emissions", unit: "gCO₂e", icon: "◆" },
  { label: "Carbon Intensity", unit: "gCO₂e/kWh", icon: "↗" },
  { label: "Functional Units", unit: "units", icon: "▦" },
];

const energyBars = [38, 55, 44, 72, 60, 84, 66, 92, 74, 58, 78, 96];

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function Dashboard() {
  return (
    <section className="ww-dashboard">

      {/* Page heading */}
      <div className="ww-dashboard-heading">
        <div>
          <span className="ww-eyebrow">OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Monitor your software's environmental performance.</p>
        </div>

        <button
          className="ww-refresh-button"
          onClick={() => window.location.reload()}
        >
          ↻ Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="ww-metrics-grid">
        {metrics.map((metric) => (
          <div className="ww-metric-card" key={metric.label}>
            <div className="ww-metric-heading">
              <span>{metric.label}</span>
              <span className="ww-metric-icon">{metric.icon}</span>
            </div>

            <strong className="ww-metric-value">—</strong>

            <div className="ww-metric-footer">
              <span>{metric.unit}</span>
              <span>Awaiting data</span>
            </div>
          </div>
        ))}
      </div>

      {/* SCI overview */}
      <div className="ww-sci-card">
        <div className="ww-sci-information">
          <span className="ww-eyebrow">SUSTAINABILITY PERFORMANCE</span>
          <h2>Software Carbon Intensity</h2>
          <p>
            Your overall SCI score appears here once calculation data is available.
          </p>

          <div className="ww-sci-status">
            <span className="ww-status-dot"></span>
            Waiting for calculation data
          </div>
        </div>

        <div className="ww-sci-circle">
          <span className="ww-circle-label">SCI</span>
          <strong>—</strong>
          <span className="ww-circle-status">NO DATA</span>
        </div>
      </div>

      {/* Charts */}
      <div className="ww-charts-grid">

        {/* Energy chart */}
        <div className="ww-chart-card">
          <div className="ww-card-heading">
            <div>
              <h2>Energy Consumption</h2>
              <p>Energy usage over time</p>
            </div>
            <span className="ww-chart-badge">ILLUSTRATIVE</span>
          </div>

          <div className="ww-energy-chart">
            <div className="ww-chart-axis">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>

            <div className="ww-bars-area">
              {energyBars.map((height, index) => (
                <div className="ww-bar-column" key={months[index]}>
                  <div
                    className="ww-energy-bar"
                    style={{ height: `${height}%` }}
                  ></div>
                  <span>{months[index]}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="ww-chart-footnote">
            Illustrative chart layout — not measured energy data.
          </p>
        </div>

        {/* Carbon intensity */}
        <div className="ww-chart-card">
          <div className="ww-card-heading">
            <div>
              <h2>Carbon Intensity</h2>
              <p>Carbon emissions per unit of energy</p>
            </div>
            <span className="ww-chart-badge">NO DATA</span>
          </div>

          <div className="ww-empty-chart">
            <span className="ww-empty-icon">↗</span>
            <strong>No carbon intensity data yet</strong>
            <p>
              Data will appear here once measurements have been recorded.
            </p>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="ww-activity-card">
        <div className="ww-card-heading">
          <div>
            <h2>Recent Activity</h2>
            <p>Your latest system records and updates</p>
          </div>
          <span className="ww-chart-badge">0 RECORDS</span>
        </div>

        <div className="ww-empty-activity">
          <span className="ww-empty-icon">▤</span>
          <strong>No recent activity</strong>
          <p>
            Recent logbook entries and system updates will appear here.
          </p>
        </div>
      </div>

    </section>
  );
}
