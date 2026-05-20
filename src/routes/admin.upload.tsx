import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";
import { getRecentImages, getImageStats, keywordPendingBatch, listImagesMissingPreview, setImagePreviewPath } from "@/lib/images.functions";
import { resizeImageToBlob } from "@/lib/resize-image";

export const Route = createFileRoute("/admin/upload")({
  component: Upload,
});

type QueueItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  imageNumber?: number;
};

function Upload() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const fetchRecent = useServerFn(getRecentImages);
  const recent = useQuery({
    queryKey: ["recent-images"],
    queryFn: () => fetchRecent({ data: { limit: 60 } }),
  });

  const fetchStats = useServerFn(getImageStats);
  const stats = useQuery({ queryKey: ["image-stats"], queryFn: () => fetchStats() });

  const runBatch = useServerFn(keywordPendingBatch);
  const batchMutation = useMutation({
    mutationFn: () => runBatch({ data: { limit: 25 } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recent-images"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });

  const fetchMissing = useServerFn(listImagesMissingPreview);
  const savePreview = useServerFn(setImagePreviewPath);
  const [backfill, setBackfill] = useState<{
    running: boolean;
    done: number;
    failed: number;
    remaining: number | null;
    message?: string;
  }>({ running: false, done: 0, failed: 0, remaining: null });

  const runBackfill = useCallback(async () => {
    setBackfill({ running: true, done: 0, failed: 0, remaining: null, message: "Starting…" });
    let done = 0;
    let failed = 0;
    // Loop in batches until no more rows are missing previews.
    // We work in batches of 10 to keep memory and signed-URL counts modest.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await fetchMissing({ data: { limit: 10 } });
      if (!rows.length) break;
      setBackfill((s) => ({ ...s, remaining: rows.length, message: `Processing ${rows.length}…` }));
      for (const r of rows) {
        try {
          if (!r.signed_url) throw new Error("no signed url");
          const resp = await fetch(r.signed_url);
          if (!resp.ok) throw new Error(`download ${resp.status}`);
          const orig = await resp.blob();
          const previewBlob = await resizeImageToBlob(orig, 600, 0.82);
          const previewPath = `previews/${r.id}.jpg`;
          const up = await supabase.storage
            .from("images-private")
            .upload(previewPath, previewBlob, { contentType: "image/jpeg", upsert: true });
          if (up.error) throw new Error(up.error.message);
          await savePreview({ data: { id: r.id, preview_path: previewPath } });
          done += 1;
        } catch (e) {
          failed += 1;
          console.error("backfill failed", r.id, e);
        }
        setBackfill((s) => ({ ...s, done, failed }));
      }
    }
    setBackfill({ running: false, done, failed, remaining: 0, message: "Done" });
    qc.invalidateQueries({ queryKey: ["recent-images"] });
  }, [fetchMissing, savePreview, qc]);


  // Revoke object URLs when component unmounts
  useEffect(() => {
    return () => {
      queue.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const uid = crypto.randomUUID();
          const storagePath = `${uid}.${ext}`;
          const previewPath = `previews/${uid}.jpg`;
          const up = await supabase.storage
            .from("images-private")
            .upload(storagePath, file, { contentType: file.type, upsert: false });
          if (up.error) throw new Error(up.error.message);

          // Build 600px preview (longest edge) and upload alongside the original
          let savedPreviewPath: string | null = null;
          try {
            const previewBlob = await resizeImageToBlob(file, 600, 0.82);
            const upPrev = await supabase.storage
              .from("images-private")
              .upload(previewPath, previewBlob, { contentType: "image/jpeg", upsert: false });
            if (!upPrev.error) savedPreviewPath = previewPath;
          } catch {
            // preview generation is non-fatal; original still uploaded
          }

          const ins = await supabase
            .from("images")
            .insert({
              filename: file.name,
              storage_path: storagePath,
              preview_path: savedPreviewPath,
            })
            .select("image_number")
            .single();
          if (ins.error) throw new Error(ins.error.message);
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id
                ? { ...it, status: "done", imageNumber: ins.data.image_number as number }
                : it,
            ),
          );
        } catch (e) {
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id ? { ...it, status: "error", message: (e as Error).message } : it,
            ),
          );
        }
      }
      qc.invalidateQueries({ queryKey: ["recent-images"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
    [qc],
  );

  return (
    <>
      <PageHeader title="Upload" />

      <div
        style={{
          border: "1px solid #000",
          padding: 16,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {stats.data
            ? `${stats.data.pending} un-keyworded · ${stats.data.total} total`
            : "Loading stats…"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {batchMutation.data && (
            <span style={{ fontSize: 11 }}>
              Last run: {batchMutation.data.processed} done
              {batchMutation.data.failed ? `, ${batchMutation.data.failed} failed` : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => batchMutation.mutate()}
            disabled={batchMutation.isPending || !stats.data?.pending}
            style={{
              background: "#000",
              color: "#fff",
              border: "1px solid #000",
              padding: "10px 16px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: batchMutation.isPending || !stats.data?.pending ? "not-allowed" : "pointer",
              opacity: batchMutation.isPending || !stats.data?.pending ? 0.5 : 1,
            }}
          >
            {batchMutation.isPending
              ? "Sending…"
              : `Keyword ${Math.min(stats.data?.pending ?? 0, 25)} now`}
          </button>
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfill.running}
            title="Generate 600px previews for any images that don't have one"
            style={{
              background: "#fff",
              color: "#000",
              border: "1px solid #000",
              padding: "10px 16px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: backfill.running ? "not-allowed" : "pointer",
              opacity: backfill.running ? 0.5 : 1,
            }}
          >
            {backfill.running
              ? `Previews: ${backfill.done}✓ ${backfill.failed ? backfill.failed + "✗ " : ""}…`
              : backfill.message === "Done"
                ? `Previews done: ${backfill.done}✓ ${backfill.failed}✗`
                : "Generate 600px previews"}
          </button>
        </div>
      </div>


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
        Drop images here or click to browse
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
                    {it.status === "done" && it.imageNumber ? `#${it.imageNumber}` : it.status.toUpperCase()}
                  </span>
                </div>
                <div style={tileName} title={it.name}>
                  {it.name}
                </div>
                {it.message && <div style={errStyle}>{it.message}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bi-section" style={{ marginTop: 32 }}>
        <h2 className="bi-section-title">
          Recent uploads {recent.data ? `(${recent.data.length})` : ""}
        </h2>
        {recent.isLoading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : !recent.data?.length ? (
          <div className="bi-placeholder">No images yet</div>
        ) : (
          <div style={gridStyle}>
            {recent.data.map((r) => (
              <Link
                key={r.id}
                to="/admin/image/$id"
                params={{ id: r.id }}
                style={{ ...tileStyle, textDecoration: "none", color: "#000" }}
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
                </div>
                <div style={tileName} title={r.title ?? r.filename}>
                  {r.title ?? r.filename}
                </div>
              </Link>
            ))}
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
