import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "./admin";
import { getVisitors, type VisitorRow } from "@/lib/visitors.functions";
import { getImageStats, keywordPendingBatch } from "@/lib/images.functions";

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
  const fetchVisitors = useServerFn(getVisitors);
  const { data, isLoading } = useQuery({
    queryKey: ["visitors"],
    queryFn: () => fetchVisitors(),
    refetchInterval: 30_000,
  });

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

      <div className="bi-stat-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="bi-stat">
          <div className="bi-stat-label">Unique visitors today</div>
          <div className="bi-stat-value">{isLoading ? "…" : data?.todayCount ?? 0}</div>
        </div>
        <div className="bi-stat">
          <div className="bi-stat-label">Unique visitors · last 30d</div>
          <div className="bi-stat-value">{isLoading ? "…" : data?.last30Count ?? 0}</div>
        </div>
      </div>

      <div className="bi-section">
        <h2 className="bi-section-title">Visitors</h2>
        {isLoading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : !data?.recent?.length ? (
          <div className="bi-placeholder">No visits yet</div>
        ) : (
          <VisitorsTable rows={data.recent} />
        )}
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

function VisitorsTable({ rows }: { rows: VisitorRow[] }) {
  return (
    <div style={{ border: "1px solid #000", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#000", color: "#fff", textTransform: "uppercase", letterSpacing: "0.02em" }}>
            <Th>Date</Th>
            <Th>Country</Th>
            <Th>City</Th>
            <Th>IP</Th>
            <Th>Path</Th>
            <Th>Referer</Th>
            <Th>User agent</Th>
            <Th>Last seen</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} style={{ borderTop: "1px solid #000" }}>
              <Td>{v.visit_date}</Td>
              <Td>{v.country || "—"}</Td>
              <Td>{[v.city, v.region].filter(Boolean).join(", ") || "—"}</Td>
              <Td><code>{v.ip}</code></Td>
              <Td>{v.path || "—"}</Td>
              <Td title={v.referer || ""}>{shorten(v.referer, 30)}</Td>
              <Td title={v.user_agent || ""}>{shorten(v.user_agent, 40)}</Td>
              <Td>{new Date(v.last_seen_at).toLocaleString()}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 800, fontSize: 11 }}>{children}</th>;
}
function Td({ children, title }: { children: React.ReactNode; title?: string }) {
  return <td style={{ padding: "10px 12px", verticalAlign: "top" }} title={title}>{children}</td>;
}
function shorten(s: string | null, n: number) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
