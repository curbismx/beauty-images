import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";
import { listFeatured, deleteFeatured, reorderFeatured, type FeaturedImage } from "@/lib/featured.functions";

export const Route = createFileRoute("/admin/featured")({
  component: Featured,
});

type QueueItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
};

function Featured() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const fetchList = useServerFn(listFeatured);
  const list = useQuery({ queryKey: ["featured-images"], queryFn: () => fetchList() });

  const del = useServerFn(deleteFeatured);
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["featured-images"] }),
  });

  const reorder = useServerFn(reorderFeatured);
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
  });

  // Local ordered copy so drag-reorder feels instant.
  const [ordered, setOrdered] = useState<FeaturedImage[]>([]);
  useEffect(() => {
    if (list.data) setOrdered(list.data);
  }, [list.data]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOrdered((prev) => {
      const from = prev.findIndex((x) => x.id === fromId);
      const to = prev.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = prev.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      reorderMut.mutate(next.map((x) => x.id));
      return next;
    });
  };


  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      const items: QueueItem[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        previewUrl: URL.createObjectURL(f),
        status: "pending",
      }));
      setQueue((q) => [...items, ...q]);

      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const item = items[i];
        setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)));
        try {
          const ext = file.name.split(".").pop() ?? "jpg";
          const storagePath = `${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage
            .from("featured-images")
            .upload(storagePath, file, { contentType: file.type, upsert: false });
          if (up.error) throw new Error(up.error.message);
          const ins = await supabase
            .from("featured_images")
            .insert({ filename: file.name, storage_path: storagePath });
          if (ins.error) throw new Error(ins.error.message);
          setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "done" } : it)));
        } catch (e) {
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id ? { ...it, status: "error", message: (e as Error).message } : it,
            ),
          );
        }
      }
      qc.invalidateQueries({ queryKey: ["featured-images"] });
    },
    [qc],
  );

  return (
    <>
      <PageHeader title="Featured Images" />

      <p style={{ fontSize: 12, marginBottom: 16, color: "#555" }}>
        Separate pool for the homepage masonry. Drop as many as you want.
      </p>

      <div
        className="bi-drop"
        style={{
          background: isDragging ? "#000" : undefined,
          color: isDragging ? "#fff" : undefined,
          cursor: "pointer",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        Drop featured images here or click to browse
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <div className="bi-section" style={{ marginTop: 32 }}>
          <h2 className="bi-section-title">This session ({queue.length})</h2>
          <div style={gridStyle}>
            {queue.map((it) => (
              <div key={it.id} style={tileStyle}>
                <div style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}>
                  <img src={it.previewUrl} alt={it.name} style={imgStyle} />
                  <span style={{ ...badgeStyle, background: statusColor(it.status) }}>
                    {it.status.toUpperCase()}
                  </span>
                </div>
                <div style={tileName} title={it.name}>{it.name}</div>
                {it.message && <div style={errStyle}>{it.message}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bi-section" style={{ marginTop: 32 }}>
        <h2 className="bi-section-title">
          Featured pool {ordered.length ? `(${ordered.length})` : ""}
        </h2>
        <p style={{ fontSize: 11, color: "#777", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Drag tiles to reorder. Top-left = first on homepage.
          {reorderMut.isPending && " · Saving…"}
        </p>
        {list.isLoading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : !ordered.length ? (
          <div className="bi-placeholder">No featured images yet</div>
        ) : (
          <div style={flatGridStyle}>
            {ordered.map((r, idx) => {
              const isDragging = dragId === r.id;
              const dragIdx = dragId ? ordered.findIndex((x) => x.id === dragId) : -1;
              const overIdx = overId ? ordered.findIndex((x) => x.id === overId) : -1;
              // Show insertion indicator on the "over" tile; side depends on
              // whether the dragged item is coming from before or after it.
              const showIndicator = overId === r.id && dragId !== null && dragId !== r.id;
              const indicatorSide: "left" | "right" =
                dragIdx >= 0 && overIdx >= 0 && dragIdx < overIdx ? "right" : "left";
              return (
                <div
                  key={r.id}
                  style={{ position: "relative" }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== r.id) setOverId(r.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragId && dragId !== r.id && overId !== r.id) setOverId(r.id);
                  }}
                  onDragLeave={(e) => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                      setOverId((o) => (o === r.id ? null : o));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== r.id) moveItem(dragId, r.id);
                    setDragId(null);
                    setOverId(null);
                  }}
                >
                  {showIndicator && (
                    <div
                      style={{
                        position: "absolute",
                        top: -4,
                        bottom: -4,
                        [indicatorSide]: -8,
                        width: 4,
                        background: "#D75F68",
                        borderRadius: 2,
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", r.id);
                      setDragId(r.id);
                    }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    style={{
                      ...tileStyle,
                      cursor: "grab",
                      opacity: isDragging ? 0.35 : 1,
                      background: "#fff",
                    }}
                  >
                    <div style={{ background: "#f4f4f4", lineHeight: 0, pointerEvents: "none" }}>
                      <img
                        src={r.url}
                        alt={r.filename}
                        style={{ width: "100%", height: "auto", display: "block" }}
                        loading="lazy"
                        draggable={false}
                      />
                    </div>
                    <div style={{ ...tileName, pointerEvents: "none" }} title={r.filename}>
                      #{idx + 1} · {r.filename}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this featured image?")) delMut.mutate(r.id);
                      }}
                      style={{
                        width: "100%",
                        background: "#fff",
                        color: "#D75F68",
                        border: "none",
                        borderTop: "1px solid #000",
                        padding: "8px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function statusColor(s: QueueItem["status"]) {
  if (s === "done") return "#000";
  if (s === "error") return "#D75F68";
  if (s === "uploading") return "#666";
  return "#aaa";
}

const previewGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
};
const tileStyle: React.CSSProperties = { border: "1px solid #000", display: "block" };
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
const errStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  color: "#D75F68",
  borderTop: "1px solid #D75F68",
};
