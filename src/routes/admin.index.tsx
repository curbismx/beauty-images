import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { PageHeader } from "./admin";
import { getVisitors, getRecentVisitors, type CountryCount, type VisitorRow } from "@/lib/visitors.functions";
import { getImageStats } from "@/lib/images.functions";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO-2 → full country name. Falls back to whatever string we have.
const COUNTRY_NAMES: Record<string, string> = {
  GB: "United Kingdom", US: "United States", FR: "France", DE: "Germany",
  NL: "Netherlands", IE: "Ireland", ES: "Spain", IT: "Italy", CA: "Canada",
  AU: "Australia", NZ: "New Zealand", JP: "Japan", CN: "China", IN: "India",
  BR: "Brazil", MX: "Mexico", PL: "Poland", SE: "Sweden", NO: "Norway",
  DK: "Denmark", FI: "Finland", BE: "Belgium", PT: "Portugal", CH: "Switzerland",
  AT: "Austria", RU: "Russia", UA: "Ukraine", TR: "Türkiye", GR: "Greece",
  ZA: "South Africa", AE: "United Arab Emirates", SG: "Singapore", HK: "Hong Kong",
  KR: "South Korea", TH: "Thailand", ID: "Indonesia", PH: "Philippines",
  MY: "Malaysia", VN: "Vietnam", EG: "Egypt", AR: "Argentina", CL: "Chile",
  CO: "Colombia", PE: "Peru", NG: "Nigeria", KE: "Kenya", MA: "Morocco",
  IL: "Israel", SA: "Saudi Arabia", CZ: "Czechia", HU: "Hungary", RO: "Romania",
  BG: "Bulgaria", HR: "Croatia", RS: "Serbia", SK: "Slovakia", SI: "Slovenia",
  EE: "Estonia", LV: "Latvia", LT: "Lithuania", LU: "Luxembourg", IS: "Iceland",
  MT: "Malta", CY: "Cyprus", TW: "Taiwan", PK: "Pakistan", BD: "Bangladesh",
  LK: "Sri Lanka", NP: "Nepal", VE: "Venezuela", EC: "Ecuador", UY: "Uruguay",
  PY: "Paraguay", BO: "Bolivia", CR: "Costa Rica", PA: "Panama", GT: "Guatemala",
  DO: "Dominican Republic", QA: "Qatar", KW: "Kuwait", BH: "Bahrain", OM: "Oman",
  JO: "Jordan", LB: "Lebanon", IQ: "Iraq", IR: "Iran", GH: "Ghana",
  TZ: "Tanzania", UG: "Uganda", ET: "Ethiopia", DZ: "Algeria", TN: "Tunisia",
  SN: "Senegal", CI: "Côte d'Ivoire", CM: "Cameroon", ZW: "Zimbabwe",
  ZM: "Zambia", AO: "Angola", MZ: "Mozambique", BW: "Botswana", NA: "Namibia",
  MU: "Mauritius", RW: "Rwanda", JM: "Jamaica", TT: "Trinidad & Tobago",
  BS: "Bahamas", BB: "Barbados", FJ: "Fiji", PG: "Papua New Guinea",
  KH: "Cambodia", LA: "Laos", MM: "Myanmar", MN: "Mongolia", KZ: "Kazakhstan",
  UZ: "Uzbekistan", GE: "Georgia", AM: "Armenia", AZ: "Azerbaijan",
  BY: "Belarus", MD: "Moldova", AL: "Albania", MK: "North Macedonia",
  BA: "Bosnia & Herzegovina", ME: "Montenegro", XK: "Kosovo", LI: "Liechtenstein",
  MC: "Monaco", AD: "Andorra", SM: "San Marino", VA: "Vatican City",
};

function countryName(code: string | null): string {
  if (!code) return "Unknown";
  const up = code.toUpperCase();
  if (up.length === 2) return COUNTRY_NAMES[up] ?? code;
  return code; // already a full name (from geo fallback) or unknown
}

// Country centroids [lng, lat] for the map markers.
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
  LU: [6, 50], IS: [-19, 65], MT: [14, 36], CY: [33, 35], TW: [121, 24],
  PK: [70, 30], BD: [90, 24], VE: [-66, 7], EC: [-78, -1], UY: [-56, -33],
  QA: [51, 25], KW: [48, 29], JO: [36, 31], LB: [36, 34], GH: [-1, 8],
  TZ: [35, -6], ET: [40, 9], DZ: [3, 28], TN: [9, 34], KZ: [67, 48],
};

type Region = { id: string; label: string; center: [number, number]; zoom: number };
const REGIONS: Region[] = [
  { id: "world", label: "World", center: [0, 10], zoom: 1 },
  { id: "europe", label: "Europe", center: [12, 52], zoom: 4.2 },
  { id: "americas", label: "Americas", center: [-80, 8], zoom: 1.7 },
  { id: "asia", label: "Asia", center: [100, 30], zoom: 2.3 },
  { id: "africa", label: "Africa", center: [20, 2], zoom: 2.3 },
  { id: "oceania", label: "Oceania", center: [145, -25], zoom: 3.4 },
];

function prettyReferer(ref: string | null): string {
  if (!ref) return "Direct";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (/google\./.test(h)) return "Google";
    if (/bing\./.test(h)) return "Bing";
    if (/duckduckgo\./.test(h)) return "DuckDuckGo";
    if (/facebook\.|fb\.com|fb\.me/.test(h)) return "Facebook";
    if (/instagram\./.test(h)) return "Instagram";
    if (/t\.co|twitter\.|x\.com/.test(h)) return "X / Twitter";
    if (/linkedin\./.test(h)) return "LinkedIn";
    if (/pinterest\./.test(h)) return "Pinterest";
    if (/youtube\.|youtu\.be/.test(h)) return "YouTube";
    if (/reddit\./.test(h)) return "Reddit";
    if (/tiktok\./.test(h)) return "TikTok";
    return h;
  } catch {
    return "Direct";
  }
}

function fmtDuration(s?: number): string {
  if (!s || s <= 0) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec ? `${m}m ${sec}s` : `${m}m`;
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Dashboard() {
  const fetchVisitors = useServerFn(getVisitors);
  const fetchImageStats = useServerFn(getImageStats);
  const fetchRecent = useServerFn(getRecentVisitors);

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

  const [recentRows, setRecentRows] = useState<VisitorRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirst = useCallback(() => {
    setRecentLoading(true);
    fetchRecent({ data: { limit: 30 } })
      .then((r) => {
        setRecentRows(r.rows);
        setCursor(r.nextCursor);
      })
      .catch(() => {})
      .finally(() => setRecentLoading(false));
  }, [fetchRecent]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetchRecent({ data: { before: cursor, limit: 30 } });
      setRecentRows((prev) => [...prev, ...r.rows]);
      setCursor(r.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, fetchRecent]);

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

      <Panel title="Where visitors come from">
        <VisitorMap countries={data?.countries ?? []} />
      </Panel>

      <Panel title="Top countries">
        <TopCountries countries={data?.countries ?? []} />
      </Panel>

      <Panel title="Recent visitors">
        <div className="dash-recent-bar">
          <button className="dash-refresh" onClick={loadFirst} disabled={recentLoading}>
            ↻ Refresh
          </button>
        </div>
        {recentLoading ? (
          <div className="dash-empty">Loading…</div>
        ) : recentRows.length === 0 ? (
          <div className="dash-empty">No visits yet</div>
        ) : (
          <>
            <RecentVisitors rows={recentRows} />
            {cursor ? (
              <button className="dash-loadmore" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <div className="dash-loadmore-end">— end of list —</div>
            )}
          </>
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
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>({
    center: REGIONS[0].center,
    zoom: REGIONS[0].zoom,
  });
  const [activeRegion, setActiveRegion] = useState("world");

  const max = useMemo(
    () => countries.reduce((a, b) => Math.max(a, b.count), 0),
    [countries],
  );
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

  function selectRegion(r: Region) {
    setActiveRegion(r.id);
    setView({ center: r.center, zoom: r.zoom });
  }

  return (
    <div>
      <div className="dash-region-tabs">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            className={`dash-region-tab${activeRegion === r.id ? " dash-region-tab--active" : ""}`}
            onClick={() => selectRegion(r)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="dash-map">
        <ComposableMap
          projectionConfig={{ scale: 155 }}
          width={980}
          height={460}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup
            center={view.center}
            zoom={view.zoom}
            minZoom={0.8}
            maxZoom={8}
            onMoveEnd={(e: any) => setView({ center: e.coordinates, zoom: e.zoom })}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#f1f1f1"
                    stroke="#c9c9c9"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "#e7e7e7" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
            {markers.map((m) => (
              <Marker key={m.key} coordinates={m.pos}>
                <circle
                  r={radius(m.count) / view.zoom}
                  fill="#D75F68"
                  fillOpacity={0.75}
                  stroke="#000"
                  strokeWidth={0.6 / view.zoom}
                />
                <title>{`${countryName(m.key)} — ${m.count}`}</title>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>
      <div className="dash-map-hint">Tap a region to zoom · drag to pan</div>
    </div>
  );
}

function TopCountries({ countries }: { countries: CountryCount[] }) {
  if (!countries.length) return <div className="dash-empty">No data</div>;
  const top = countries.slice(0, 12);
  const max = top[0]?.count || 1;
  return (
    <ul className="dash-top">
      {top.map((c) => (
        <li key={c.country}>
          <span className="dash-top-name">{countryName(c.country)}</span>
          <span className="dash-top-bar">
            <span className="dash-top-fill" style={{ width: `${(c.count / max) * 100}%` }} />
          </span>
          <span className="dash-top-count">{c.count}</span>
        </li>
      ))}
    </ul>
  );
}

function RecentVisitors({ rows }: { rows: VisitorRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="dash-visits">
      {rows.map((v) => {
        const place = [v.city, v.region].filter(Boolean).join(", ");
        const pages = v.pages ?? [];
        const canExpand = pages.length > 0;
        const isOpen = open === v.id;
        return (
          <li key={v.id} className="dash-visit">
            <div
              className="dash-visit-row"
              onClick={() => canExpand && setOpen(isOpen ? null : v.id)}
              style={{ cursor: canExpand ? "pointer" : "default" }}
            >
              <span className={`dash-tri${isOpen ? " dash-tri--open" : ""}${canExpand ? "" : " dash-tri--hidden"}`}>
                ▸
              </span>
              <span className="dash-visit-main">
                <span className="dash-visit-l1">
                  <strong>{countryName(v.country)}</strong>
                  {place && <span className="dash-visit-place"> · {place}</span>}
                  <span className="dash-visit-when"> · {fmtWhen(v.last_seen_at)}</span>
                </span>
                <span className="dash-visit-l2">
                  {v.referer ? (
                    <a
                      className="dash-chip dash-chip--link"
                      href={v.referer}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={v.referer}
                    >
                      From: {prettyReferer(v.referer)} ↗
                    </a>
                  ) : (
                    <span className="dash-chip">From: Direct</span>
                  )}
                  <span className="dash-chip">
                    {v.pageCount ?? 0} {(v.pageCount ?? 0) === 1 ? "page" : "pages"}
                  </span>
                  <span className="dash-chip">{fmtDuration(v.durationSeconds)} on site</span>
                  <span className="dash-chip dash-chip--muted">
                    Landed: {v.pages?.[0] ?? v.path ?? "—"}
                  </span>
                </span>
              </span>
            </div>
            {isOpen && canExpand && (
              <ol className="dash-visit-pages">
                {pages.map((p, i) => (
                  <li key={i}>
                    <span className="dash-page-i">{i + 1}</span>
                    <span className="dash-page-path">{p}</span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const dashCss = `
.dash-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.dash-stat { border: 1px solid #000; padding: 14px 16px; }
.dash-stat-label { font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #555; margin-bottom: 6px; }
.dash-stat-value { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }

.dash-panel { border: 1px solid #000; margin-bottom: 16px; }
.dash-panel-title { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 0; padding: 10px 14px; border-bottom: 1px solid #000; background: #000; color: #fff; }
.dash-panel-body { padding: 14px; }
.dash-empty { font-size: 11px; color: #888; text-align: center; padding: 24px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }

/* Region tabs */
.dash-region-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.dash-region-tab { background: #fff; color: #000; border: 1px solid #000; padding: 7px 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.dash-region-tab:hover { background: #f0f0f0; }
.dash-region-tab--active { background: #000; color: #fff; }
.dash-map { width: 100%; border: 1px solid #eee; }
.dash-map-hint { font-size: 10px; color: #999; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; margin-top: 8px; }

/* Top countries */
.dash-top { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.dash-top li { display: grid; grid-template-columns: 180px 1fr 44px; align-items: center; gap: 12px; font-size: 13px; }
.dash-top-name { font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dash-top-bar { height: 10px; background: #f0f0f0; position: relative; }
.dash-top-fill { position: absolute; inset: 0 auto 0 0; background: #D75F68; }
.dash-top-count { text-align: right; font-weight: 900; font-variant-numeric: tabular-nums; }

/* Recent visitors */
.dash-visits { list-style: none; padding: 0; margin: 0; }
.dash-visit { border-bottom: 1px solid #eee; }
.dash-visit:last-child { border-bottom: 0; }
.dash-visit-row { width: 100%; display: flex; align-items: flex-start; gap: 10px; background: none; border: 0; text-align: left; padding: 12px 4px; font-family: inherit; }
.dash-visit-row:hover { background: #fafafa; }
.dash-tri { font-size: 11px; color: #D75F68; padding-top: 3px; transition: transform 0.15s ease; }
.dash-tri--open { transform: rotate(90deg); }
.dash-tri--hidden { visibility: hidden; }
.dash-visit-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
.dash-visit-l1 { font-size: 14px; color: #111; }
.dash-visit-l1 strong { font-weight: 900; }
.dash-visit-place { color: #555; }
.dash-visit-when { color: #999; }
.dash-visit-l2 { display: flex; flex-wrap: wrap; gap: 6px; }
.dash-chip { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; color: #333; background: #f3f3f3; padding: 3px 8px; }
.dash-chip--muted { color: #777; background: transparent; padding-left: 0; }
.dash-chip--link { color: #fff; background: #D75F68; text-decoration: none; cursor: pointer; }
.dash-chip--link:hover { background: #b94e56; }
.dash-visit-pages { list-style: none; margin: 0 0 12px; padding: 8px 0 8px 36px; }
.dash-visit-pages li { display: flex; gap: 10px; padding: 4px 0; font-size: 12px; color: #444; }
.dash-page-i { color: #bbb; font-weight: 800; font-variant-numeric: tabular-nums; min-width: 18px; }
.dash-page-path { word-break: break-all; }
.dash-recent-bar { display: flex; justify-content: flex-end; margin-bottom: 4px; }
.dash-refresh { background: #fff; color: #000; border: 1px solid #000; padding: 6px 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.dash-refresh:hover { background: #000; color: #fff; }
.dash-refresh:disabled { opacity: 0.5; cursor: default; }
.dash-loadmore { display: block; width: 100%; margin-top: 12px; background: #000; color: #fff; border: 1px solid #000; padding: 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.dash-loadmore:hover { background: #D75F68; border-color: #D75F68; }
.dash-loadmore:disabled { opacity: 0.6; cursor: default; }
.dash-loadmore-end { text-align: center; margin-top: 12px; font-size: 10px; color: #aaa; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }

@media (max-width: 768px) {
  .dash-stats { grid-template-columns: repeat(2, 1fr); }
  .dash-stat-value { font-size: 22px; }
  .dash-top li { grid-template-columns: 110px 1fr 36px; gap: 8px; font-size: 12px; }
}
`;
