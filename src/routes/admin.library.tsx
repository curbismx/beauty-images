import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "./admin";
import {
  listImages,
  getImageStats,
  publishAllReady,
  unpublishAll,
  deleteImages,
  updateImage,
  type LibraryImage,
} from "@/lib/images.functions";

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const fetchList = useServerFn(listImages);
  const fetchStats = useServerFn(getImageStats);
  const runPublish = useServerFn(publishAllReady);
  const runUnpublish = useServerFn(unpublishAll);
  const runDelete = useServerFn(deleteImages);

  const q = useQuery({
    queryKey: ["library-images", active, search],
    queryFn: () => fetchList({ data: { filter: active, search, limit: 500 } }),
  });
  const stats = useQuery({
    queryKey: ["image-stats"],
    queryFn: () => fetchStats({}),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["library-images"] });
    qc.invalidateQueries({ queryKey: ["image-stats"] });
  };

  const publishMut = useMutation({
    mutationFn: () => runPublish({}),
    onSuccess: invalidate,
  });
  const unpublishMut = useMutation({
    mutationFn: () => runUnpublish({}),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => runDelete({ data: { ids } }),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });

  const rows = q.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader title="Library" />


      <div style={batchBar}>
        <div style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {stats.data
            ? `${stats.data.total} total · ${stats.data.pending} pending keywords`
            : "—"}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={btnDark}
            disabled={publishMut.isPending}
            onClick={() => {
              if (confirm("Publish ALL keyworded images to the site?")) publishMut.mutate();
            }}
          >
            {publishMut.isPending ? "Publishing…" : "Publish all ready"}
          </button>
          <button
            style={btnGhost}
            disabled={unpublishMut.isPending}
            onClick={() => {
              if (confirm("Unpublish ALL images from the site?")) unpublishMut.mutate();
            }}
          >
            {unpublishMut.isPending ? "…" : "Unpublish all"}
          </button>
        </div>
      </div>
      {publishMut.data && (
        <div style={notice}>Published {publishMut.data.published} images.</div>
      )}
      {unpublishMut.data && (
        <div style={notice}>Unpublished {unpublishMut.data.unpublished} images.</div>
      )}

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

      <div style={selBar}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer" }}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select all ({rows.length})
        </label>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{selected.size} selected</div>
        <button
          style={{ ...btnDark, background: selected.size ? "#a32020" : "#ccc", borderColor: selected.size ? "#a32020" : "#ccc", cursor: selected.size ? "pointer" : "not-allowed" }}
          disabled={!selected.size || deleteMut.isPending}
          onClick={() => {
            if (confirm(`Delete ${selected.size} image(s)? This cannot be undone.`))
              deleteMut.mutate(Array.from(selected));
          }}
        >
          {deleteMut.isPending ? "Deleting…" : `Delete selected`}
        </button>
      </div>
      {deleteMut.data && (
        <div style={notice}>Deleted {deleteMut.data.deleted} images.</div>
      )}

      {q.isLoading ? (
        <div className="bi-placeholder">Loading…</div>
      ) : !rows.length ? (
        <div className="bi-placeholder">No images</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => {
            const isSel = selected.has(r.id);
            return (
              <div key={r.id} style={{ ...rowStyle, outline: isSel ? "2px solid #a32020" : "none" }}>
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #000", padding: "0 10px", cursor: "pointer" }}
                  onClick={() => toggleOne(r.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleOne(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 18, height: 18 }}
                  />
                </div>
                <Link
                  to="/admin/image/$id"
                  params={{ id: r.id }}
                  style={{ display: "contents", textDecoration: "none", color: "#000" }}
                >
                  <div style={thumbWrap}>
                    {r.signed_url ? (
                      <img src={r.signed_url} alt={r.filename} style={thumbImg} loading="lazy" />
                    ) : (
                      <div style={{ ...thumbImg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                        NO PREVIEW
                      </div>
                    )}
                  </div>
                  <div style={contentCol}>
                    <div style={topRow}>
                      <span style={numBadge}>{r.image_number}</span>
                      {!r.keyworded_at && <span style={{ ...statusBadge, background: "#D75F68" }}>PENDING</span>}
                      {r.keyworded_at && r.public && <span style={{ ...statusBadge, background: "#1f7a3d" }}>LIVE</span>}
                      {r.keyworded_at && !r.public && <span style={{ ...statusBadge, background: "#888" }}>READY</span>}
                      {r.category && <span style={catBadge}>{r.category}</span>}
                    </div>
                    <div style={titleStyle}>{r.title ?? stripExt(r.filename)}</div>
                    {r.caption && <div style={captionStyle}>{r.caption}</div>}
                    {r.keywords?.length > 0 && (
                      <div style={kwWrap}>
                        {r.keywords.map((k, i) => (
                          <span key={i} style={kwChip}>{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

const batchBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #000",
  padding: "12px 16px",
  marginBottom: 12,
  flexWrap: "wrap",
  gap: 8,
};
const btnDark: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  border: "1px solid #000",
  padding: "8px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = { ...btnDark, background: "#fff", color: "#000" };
const notice: React.CSSProperties = {
  padding: "8px 12px",
  background: "#f4f4f4",
  border: "1px solid #000",
  marginBottom: 12,
  fontSize: 12,
};
const selBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "10px 14px",
  border: "1px solid #000",
  marginBottom: 12,
  justifyContent: "space-between",
  flexWrap: "wrap",
};
const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "50px 200px 1fr",
  gap: 0,
  border: "1px solid #000",
  textDecoration: "none",
  color: "#000",
  background: "#fff",
};
const thumbWrap: React.CSSProperties = {
  position: "relative",
  width: 200,
  height: 200,
  background: "#f4f4f4",
};
const thumbImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};
const contentCol: React.CSSProperties = {
  padding: "12px 16px 14px 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
};
const topRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};
const numBadge: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  fontSize: 10,
  fontWeight: 800,
  padding: "3px 7px",
  letterSpacing: "0.02em",
};
const statusBadge: React.CSSProperties = { ...numBadge };
const catBadge: React.CSSProperties = {
  border: "1px solid #000",
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 6px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "0.01em",
};
const captionStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: "#222",
};
const kwWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginTop: 2,
};
const kwChip: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 6px",
  background: "#f0f0f0",
  border: "1px solid #ddd",
  letterSpacing: "0.02em",
};
