import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/library")({
  component: Library,
});

const FILTERS = ["All", "No keywords", "Available", "On hold", "Licensed"];

function Library() {
  const [active, setActive] = useState("All");
  return (
    <>
      <PageHeader title="Library" />
      <input className="bi-input" placeholder="Search images…" />
      <div className="bi-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`bi-filter-btn${active === f ? " bi-filter-btn--active" : ""}`}
            onClick={() => setActive(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="bi-grid-placeholder">No images yet</div>
    </>
  );
}
