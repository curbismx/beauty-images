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
            ? `${stats.data.total} total · ${stats.data.keyworded} keyworded · ${stats.data.processing} processing · ${stats.data.failed} failed`
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((r) => (
            <EditableRow
              key={r.id}
              row={r}
              selected={selected.has(r.id)}
              onToggle={() => toggleOne(r.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EditableRow({
  row,
  selected,
  onToggle,
}: {
  row: LibraryImage;
  selected: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const runUpdate = useServerFn(updateImage);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.title ?? "");
  const [caption, setCaption] = useState(row.caption ?? "");
  const [keywordsText, setKeywordsText] = useState((row.keywords ?? []).join(", "));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when row data refreshes from server
  useEffect(() => {
    if (!editing) {
      setTitle(row.title ?? "");
      setCaption(row.caption ?? "");
      setKeywordsText((row.keywords ?? []).join(", "));
    }
  }, [row.title, row.caption, row.keywords, editing]);

  const save = useMutation({
    mutationFn: () =>
      runUpdate({
        data: {
          id: row.id,
          title: title.trim() || null,
          caption: caption.trim() || null,
          keywords: keywordsText
            .split(",")
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 60),
        },
      }),
    onMutate: () => setStatus("saving"),
    onSuccess: () => {
      setStatus("saved");
      qc.invalidateQueries({ queryKey: ["library-images"] });
      setTimeout(() => setStatus("idle"), 1500);
    },
    onError: () => setStatus("error"),
  });

  const scheduleSave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate(), 800);
  };

  const flushSave = () => {
    if (timer.current) clearTimeout(timer.current);
    save.mutate();
  };

  const displayKeywords = row.keywords ?? [];

  return (
    <div style={{ ...rowStyle, outline: selected ? "2px solid #a32020" : "none" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #000", padding: "0 14px", cursor: "pointer", background: "#fafafa" }}
        onClick={onToggle}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 20, height: 20 }}
        />
      </div>
      <div style={thumbWrap}>
        {row.signed_url ? (
          <img src={row.signed_url} alt={row.filename} style={thumbImg} loading="lazy" />
        ) : (
          <div style={{ ...thumbImg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
            NO PREVIEW
          </div>
        )}
      </div>
      <div style={contentCol}>
        <div style={topRow}>
          <span style={numBadge}>{String(row.image_number).padStart(8, "0")}</span>
          {!row.keyworded_at && <span style={{ ...statusBadge, background: "#D75F68" }}>PENDING</span>}
          {row.keyworded_at && row.public && <span style={{ ...statusBadge, background: "#D75F68" }}>PUBLISHED</span>}
          {row.keyworded_at && !row.public && <span style={{ ...statusBadge, background: "#888" }}>READY</span>}
          {row.category && <span style={catBadge}>{row.category}</span>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {status !== "idle" && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color:
                  status === "saving" ? "#666" :
                  status === "saved" ? "#1f7a3d" : "#a32020",
              }}>
                {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : "Error"}
              </span>
            )}
            <button
              type="button"
              style={editing ? btnDone : btnEdit}
              onClick={() => {
                if (editing) flushSave();
                setEditing(!editing);
              }}
            >
              {editing ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {editing ? (
          <>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
              placeholder="Title"
              style={titleInput}
            />
            <textarea
              value={caption}
              onChange={(e) => { setCaption(e.target.value); scheduleSave(); }}
              placeholder="Caption / description"
              rows={3}
              style={captionInput}
            />
            <div>
              <div style={fieldLabel}>Keywords (comma-separated)</div>
              <textarea
                value={keywordsText}
                onChange={(e) => { setKeywordsText(e.target.value); scheduleSave(); }}
                placeholder="keyword1, keyword2, …"
                rows={2}
                style={kwInput}
              />
            </div>
          </>
        ) : (
          <>
            <div style={titleStyle}>{row.title ?? stripExt(row.filename)}</div>
            {row.caption && <div style={captionStyle}>{row.caption}</div>}
            {displayKeywords.length > 0 && (
              <div style={kwWrap}>
                {displayKeywords.map((k, i) => (
                  <span key={i} style={kwChip}>{k}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
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
  gridTemplateColumns: "60px 280px 1fr",
  gap: 0,
  border: "1px solid #000",
  textDecoration: "none",
  color: "#000",
  background: "#fff",
  boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
};
const thumbWrap: React.CSSProperties = {
  position: "relative",
  width: 280,
  height: 280,
  background: "#f4f4f4",
};
const thumbImg: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};
const contentCol: React.CSSProperties = {
  padding: "20px 24px 22px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
};
const topRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};
const numBadge: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 9px",
  letterSpacing: "0.02em",
};
const statusBadge: React.CSSProperties = { ...numBadge };
const catBadge: React.CSSProperties = {
  border: "1px solid #000",
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: "0.01em",
  lineHeight: 1.3,
};
const captionStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "#222",
};
const kwWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  marginTop: 4,
};
const kwChip: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 8px",
  background: "#f0f0f0",
  border: "1px solid #ddd",
  letterSpacing: "0.02em",
  borderRadius: 2,
};
const btnEdit: React.CSSProperties = {
  background: "#fff",
  color: "#000",
  border: "1px solid #000",
  padding: "8px 18px",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const btnDone: React.CSSProperties = {
  ...btnEdit,
  background: "#1f7a3d",
  color: "#fff",
  borderColor: "#1f7a3d",
};
const titleInput: React.CSSProperties = {
  width: "100%",
  fontSize: 18,
  fontWeight: 800,
  padding: "8px 10px",
  border: "1px solid #000",
  background: "#fff",
};
const captionInput: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  lineHeight: 1.5,
  padding: "8px 10px",
  border: "1px solid #000",
  background: "#fff",
  resize: "vertical",
  fontFamily: "inherit",
};
const kwInput: React.CSSProperties = {
  ...captionInput,
  fontSize: 13,
};
const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#666",
  marginBottom: 4,
};
