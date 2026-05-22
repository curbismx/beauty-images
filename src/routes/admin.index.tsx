import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { PageHeader } from "./admin";
import { getVisitors, type CountryCount, type VisitorRow } from "@/lib/visitors.functions";
import { getImageStats } from "@/lib/images.functions";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Approximate country centroids [lng, lat] for marker placement.
const CENTROIDS: Record<string, [number, number]> = {
  GB: [-2, 54], US: [-98, 39], FR: [2, 46], DE: [10, 51], NL: [5, 52],
  IE: [-8, 53], ES: [-4, 40], IT: [12, 42], CA: [-106, 56], AU: [134, -25],
  NZ: [172, -41], JP: [138, 36], CN: [104, 35], IN: [78, 22], BR: [-55, -10],
  MX: [-102, 23], PL: [19, 52], SE: [15, 62], NO: [10, 62], DK: [10, 56],
  FI: [26, 64], BE: [4, 50], PT: [-8, 39], CH: [8, 47], AT: [14, 47],
  RU: [105, 61], UA: [32, 49], TR: [35, 39], GR: [22, 39], ZA: [25, -29],
  AE: [54, 24], SG: [104, 1], HK: [114, 22], KR: [128, 36], TH: [101, 15],
  ID: [113, -2], PH: [122, 13], MY: [102, 4], VN: [108, 16], EG: [30, 27],
  AR: [-64, -34], CL: [-71, -35], CO: [-74, 4], PE: [-75, -10], NG: [8, 9],
  KE: [38, 0], MA: [-7, 32], IL: [35, 31], SA: [45, 24], CZ: [15, 50],
  HU: [19, 47], RO: [25, 46], BG: [25, 43], HR: [16, 45], RS: [21, 44],
  SK: [19, 49], SI: [15, 46], EE: [26, 59], LV: [25, 57], LT: [24, 56],
  LU: [6, 50], IS: [-19, 65], MT: [14, 36], CY: [33, 35],
};

function Dashboard() {
  const fetchVisitors = useServerFn(getVisitors);
  const fetchImageStats = useServerFn(getImageStats);

  const { data, isLoading } = useQuery({
    queryKey: ["visitors"],
    queryFn: () => fetchVisitors(),
    refetchInterval: 30_000,
  });

  const imgStats = useQuery({
    queryKey: ["image-stats"],
    queryFn: () => fetchImageStats(),
    refetchInterval: 30_000,
  });

  return (
    <>
      <style>{dashCss}</style>
      <PageHeader title="Dashboard" />

      <div className="dash-stats">
        <Stat label="Images published" value={imgStats.isLoading ? "…" : imgStats.data?.published ?? 0} />
        <Stat label="Visitors today" value={isLoading ? "…" : data?.todayCount ?? 0} />
        <Stat label="This week" value={isLoading ? "…" : data?.weekCount ?? 0} />
        <Stat label="This month" value={isLoading ? "…" : data?.monthCount ?? 0} />
        <Stat label="All time" value={isLoading ? "…" : data?.allTimeCount ?? 0} />
      </div>

      <div className="dash-grid">
        <Panel title="Where visitors come from">
          <VisitorMap countries={data?.countries ?? []} />
        </Panel>
        <Panel title="Top countries">
          <TopCountries countries={data?.countries ?? []} />
        </Panel>
      </div>

      <Panel title="Recent visitors">
        {isLoading ? (
          <div className="dash-empty">Loading…</div>
        ) : !data?.recent?.length ? (
          <div className="dash-empty">No visits yet</div>
        ) : (
          <VisitorsTable rows={data.recent.slice(0, 25)} />
        )}
      </Panel>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-label">{label}</div>
      <div className="dash-stat-value">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dash-panel">
      <h2 className="dash-panel-title">{title}</h2>
      <div className="dash-panel-body">{children}</div>
    </section>
  );
}

function VisitorMap({ countries }: { countries: CountryCount[] }) {
  const max = useMemo(() => countries.reduce((a, b) => Math.max(a, b.count), 0), [countries]);
  const markers = useMemo(
    () =>
      countries
        .map((c) => {
          const key = c.country.toUpperCase();
          const pos = CENTROIDS[key];
          return pos ? { key, count: c.count, pos } : null;
        })
        .filter(Boolean) as { key: string; count: number; pos: [number, number] }[],
    [countries],
  );

  const radius = (n: number) => {
    if (!max) return 0;
    const t = Math.log(n + 1) / Math.log(max + 1 || 2);
    return 3 + t * 9;
  };

  return (
    <div className="dash-map">
      <ComposableMap projectionConfig={{ scale: 130 }} width={800} height={380} style={{ width: "100%", height: "auto" }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#f3f3f3"
                stroke="#bbb"
                strokeWidth={0.3}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fill: "#eee" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        {markers.map((m) => (
          <Marker key={m.key} coordinates={m.pos}>
            <circle r={radius(m.count)} fill="#D75F68" fillOpacity={0.7} stroke="#000" strokeWidth={0.5} />
            <title>{`${m.key} — ${m.count}`}</title>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}

function TopCountries({ countries }: { countries: CountryCount[] }) {
  if (!countries.length) return <div className="dash-empty">No data</div>;
  return (
    <ul className="dash-top">
      {countries.slice(0, 10).map((c) => (
        <li key={c.country}>
          <span>{c.country}</span>
          <span>{c.count}</span>
        </li>
      ))}
    </ul>
  );
}

function VisitorsTable({ rows }: { rows: VisitorRow[] }) {
  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Country</th>
            <th>City</th>
            <th>IP</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td>{v.visit_date}</td>
              <td>{v.country || "—"}</td>
              <td>{[v.city, v.region].filter(Boolean).join(", ") || "—"}</td>
              <td><code>{v.ip}</code></td>
              <td title={v.path || ""}>{shorten(v.path, 24)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shorten(s: string | null, n: number) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const dashCss = `
.dash-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
.dash-stat { border: 1px solid #000; padding: 10px 12px; }
.dash-stat-label { font-size: 9px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
.dash-stat-value { font-size: 20px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
.dash-grid { display: grid; grid-template-columns: 1fr 220px; gap: 12px; margin-bottom: 20px; }
.dash-panel { border: 1px solid #000; margin-bottom: 12px; }
.dash-panel-title { font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 0; padding: 8px 10px; border-bottom: 1px solid #000; background: #000; color: #fff; }
.dash-panel-body { padding: 10px; }
.dash-map { width: 100%; }
.dash-top { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
.dash-top li { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; padding: 4px 0; border-bottom: 1px solid #eee; }
.dash-empty { font-size: 11px; color: #888; text-align: center; padding: 16px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.dash-table-wrap { overflow-x: auto; }
.dash-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.dash-table th { text-align: left; padding: 6px 8px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; background: #f5f5f5; border-bottom: 1px solid #000; }
.dash-table td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
.dash-table code { font-size: 10px; }

@media (max-width: 768px) {
  .dash-stats { grid-template-columns: repeat(2, 1fr); }
  .dash-grid { grid-template-columns: 1fr; }
  .dash-stat-value { font-size: 18px; }
}
`;
