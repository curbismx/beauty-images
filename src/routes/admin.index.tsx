import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { PageHeader } from "./admin";
import { getVisitors, type CountryCount, type VisitorRow } from "@/lib/visitors.functions";
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

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function Dashboard() {
  const fetchVisitors = useServerFn(getVisitors);
  const fetchImageStats = useServerFn(getImageStats);
  const runBatch = useServerFn(keywordPendingBatch);
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["visitors"],
    queryFn: () => fetchVisitors(),
    refetchInterval: 30_000,
  });

  const imgStats = useQuery({
    queryKey: ["image-stats"],
    queryFn: () => fetchImageStats(),
    refetchInterval: 15_000,
  });

  const batchMutation = useMutation({
    mutationFn: () => runBatch({ data: { limit: 25 } }),
    onSuccess: (r) => {
      setLastResult(
        `Keyworded ${r.processed}, failed ${r.failed}${r.errors.length ? " — " + r.errors.slice(0, 3).join("; ") : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
    onError: (e) => setLastResult((e as Error).message),
  });

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="bi-section">
        <h2 className="bi-section-title">Keywording</h2>
        <div style={{ border: "1px solid #000", padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 24, alignItems: "center" }}>
          <div>
            <div className="bi-stat-label">Total images</div>
            <div className="bi-stat-value">{imgStats.isLoading ? "…" : imgStats.data?.total ?? 0}</div>
          </div>
          <div>
            <div className="bi-stat-label">Pending keywords</div>
            <div className="bi-stat-value" style={{ color: (imgStats.data?.pending ?? 0) > 0 ? "#D75F68" : "#000" }}>
              {imgStats.isLoading ? "…" : imgStats.data?.pending ?? 0}
            </div>
          </div>
          <button
            className="bi-btn bi-btn--accent"
            disabled={batchMutation.isPending || (imgStats.data?.pending ?? 0) === 0}
            onClick={() => { setLastResult(null); batchMutation.mutate(); }}
          >
            {batchMutation.isPending ? "Sending…" : `Keyword ${Math.min(imgStats.data?.pending ?? 0, 25)} now`}
          </button>
        </div>
        {lastResult && (
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #000", fontSize: 12, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase" }}>
            {lastResult}
          </div>
        )}
      </div>

      <div className="bi-stat-row">
        {STATS.map((s) => (
          <div key={s.label} className="bi-stat">
            <div className="bi-stat-label">{s.label}</div>
            <div className="bi-stat-value">—</div>
          </div>
        ))}
      </div>

      <div className="bi-section">
        <h2 className="bi-section-title">Unique visitors</h2>
        <div className="bi-stat-row">
          <div className="bi-stat">
            <div className="bi-stat-label">Today</div>
            <div className="bi-stat-value">{isLoading ? "…" : data?.todayCount ?? 0}</div>
          </div>
          <div className="bi-stat">
            <div className="bi-stat-label">This week</div>
            <div className="bi-stat-value">{isLoading ? "…" : data?.weekCount ?? 0}</div>
          </div>
          <div className="bi-stat">
            <div className="bi-stat-label">This month</div>
            <div className="bi-stat-value">{isLoading ? "…" : data?.monthCount ?? 0}</div>
          </div>
          <div className="bi-stat">
            <div className="bi-stat-label">All time</div>
            <div className="bi-stat-value">{isLoading ? "…" : data?.allTimeCount ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="bi-section">
        <h2 className="bi-section-title">Where visitors come from</h2>
        <VisitorMap countries={data?.countries ?? []} />
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

function VisitorMap({ countries }: { countries: CountryCount[] }) {
  const lookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) m.set(c.country.toUpperCase(), c.count);
    return m;
  }, [countries]);

  const max = useMemo(
    () => countries.reduce((a, b) => Math.max(a, b.count), 0),
    [countries],
  );

  const colorFor = (n: number) => {
    if (!n) return "#f3f3f3";
    const t = Math.min(1, Math.log(n + 1) / Math.log(max + 1 || 2));
    // interpolate from light pink to brand red #D75F68
    const r = Math.round(255 + (215 - 255) * t);
    const g = Math.round(235 + (95 - 235) * t);
    const b = Math.round(238 + (104 - 238) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 24, border: "1px solid #000", padding: 16 }}>
      <div style={{ width: "100%" }}>
        <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={400} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // world-atlas uses ISO numeric ids; properties.name has the name.
                // react-simple-maps exposes ISO_A2 via properties when available.
                const iso2 = (geo.properties as { iso_a2?: string; ISO_A2?: string }).iso_a2 ||
                  (geo.properties as { ISO_A2?: string }).ISO_A2 || "";
                const name = (geo.properties as { name?: string }).name || "";
                const count = lookup.get(iso2.toUpperCase()) || lookup.get(name.toUpperCase()) || 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={colorFor(count)}
                    stroke="#000"
                    strokeWidth={0.3}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "#D75F68" },
                      pressed: { outline: "none" },
                    }}
                  >
                    <title>{`${name}${count ? ` — ${count} visitors` : ""}`}</title>
                  </Geography>
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
      <div>
        <div className="bi-stat-label" style={{ marginBottom: 12 }}>Top countries</div>
        {countries.length === 0 ? (
          <div style={{ fontSize: 12, color: "#888" }}>No data</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {countries.slice(0, 10).map((c) => (
              <li key={c.country} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800, letterSpacing: "0.02em", textTransform: "uppercase", borderBottom: "1px solid #eee", paddingBottom: 4 }}>
                <span>{c.country}</span>
                <span>{c.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
