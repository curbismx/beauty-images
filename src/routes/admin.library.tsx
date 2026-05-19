import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "./admin";
import { listImages } from "@/lib/images.functions";

export const Route = createFileRoute("/admin/library")({
  component: Library,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending keywords" },
  { id: "ready", label: "Ready to publish" },
  { id: "published", label: "Published" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function Library() {
  const [active, setActive] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const fetchList = useServerFn(listImages);
  const q = useQuery({
    queryKey: ["library-images", active, search],
    queryFn: () => fetchList({ data: { filter: active, search, limit: 300 } }),
  });

  return (
    <>
      <PageHeader title="Library" />
      <input
        className="bi-input"
        placeholder="Search title, filename, category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="bi-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`bi-filter-btn${active === f.id ? " bi-filter-btn--active" : ""}`}
            onClick={() => setActive(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="bi-placeholder">Loading…</div>
      ) : !q.data?.length ? (
        <div className="bi-placeholder">No images</div>
      ) : (
        <div style={gridStyle}>
          {q.data.map((r) => (
            <Link
              key={r.id}
              to="/admin/image/$id"
              params={{ id: r.id }}
              style={tileStyle}
            >
              <div style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}>
                {r.signed_url ? (
                  <img src={r.signed_url} alt={r.filename} style={imgStyle} loading="lazy" />
                ) : (
                  <div style={{ ...imgStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                    NO PREVIEW
                  </div>
                )}
                <span style={{ ...badgeStyle, background: "#000" }}>#{r.image_number}</span>
                {!r.keyworded_at && (
                  <span style={{ ...badgeStyle, background: "#D75F68", left: "auto", right: 8 }}>
                    PENDING
                  </span>
                )}
                {r.keyworded_at && r.public && (
                  <span style={{ ...badgeStyle, background: "#1f7a3d", left: "auto", right: 8 }}>
                    LIVE
                  </span>
                )}
              </div>
              <div style={tileName}>{r.title ?? r.filename}</div>
              {r.category && <div style={tileMeta}>{r.category}</div>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 12,
};
const tileStyle: React.CSSProperties = {
  border: "1px solid #000",
  display: "block",
  textDecoration: "none",
  color: "#000",
};
const imgStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};
const badgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  color: "#fff",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.02em",
  padding: "4px 8px",
};
const tileName: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  borderTop: "1px solid #000",
};
const tileMeta: React.CSSProperties = {
  padding: "0 10px 8px",
  fontSize: 10,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#666",
};
