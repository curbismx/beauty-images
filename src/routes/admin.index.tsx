import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const STATS = [
  { label: "Revenue today" },
  { label: "Revenue month" },
  { label: "Revenue year" },
  { label: "Revenue lifetime" },
];

function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="bi-stat-row">
        {STATS.map((s) => (
          <div key={s.label} className="bi-stat">
            <div className="bi-stat-label">{s.label}</div>
            <div className="bi-stat-value">—</div>
          </div>
        ))}
      </div>
      <div className="bi-section">
        <h2 className="bi-section-title">Recent sales</h2>
        <div className="bi-placeholder">No data yet</div>
      </div>
      <div className="bi-section">
        <h2 className="bi-section-title">Alerts</h2>
        <div className="bi-placeholder">No alerts</div>
      </div>
    </>
  );
}
