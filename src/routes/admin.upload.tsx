import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";
import {
  getImageStats,
  getProcessingQueue,
  checkImageNumberExists,
  retryImageProcessing,
} from "@/lib/images.functions";

export const Route = createFileRoute("/admin/upload")({
  component: Upload,
});

const FILENAME_RE = /^a(\d{8})\.[a-z0-9]+$/i;

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

  const fetchQueue = useServerFn(getProcessingQueue);
  const processing = useQuery({
    queryKey: ["processing-queue"],
    queryFn: () => fetchQueue({ data: { limit: 300 } }),
    refetchInterval: 15_000,
  });

  const fetchStats = useServerFn(getImageStats);
  const stats = useQuery({
    queryKey: ["image-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 15_000,
  });

  const checkNumber = useServerFn(checkImageNumberExists);
  const runRetry = useServerFn(retryImageProcessing);
  const retryMut = useMutation({
    mutationFn: (id: string) => runRetry({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });

  useEffect(() => {
    return () => {
      queue.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
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
        const match = file.name.match(FILENAME_RE);
        if (!match) {
          setQueue((q) =>
            q.map((it) =>
              it.id === item.id
                ? { ...it, status: "error", message: `Invalid filename — must be A + 8 digits + extension` }
                : it,
            ),
          );
          continue;
        }
        const parsedNumber = parseInt(match[1], 10);
        setQueue((q) => q.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)));
        try {
          const dup = await checkNumber({ data: { image_number: parsedNumber } });
          if (dup.exists) throw new Error(`Duplicate number — #${String(parsedNumber).padStart(8, "0")} already exists`);

          const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const uid = crypto.randomUUID();
          const storagePath = `${uid}.${ext}`;
          const up = await supabase.storage
            .from("images-private")
            .upload(storagePath, file, { contentType: file.type || "image/jpeg", upsert: false });
          if (up.error) throw new Error(up.error.message);

          const ins = await supabase
            .from("images")
            .insert({
              filename: file.name,
              storage_path: storagePath,
              image_number: parsedNumber,
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
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
    [qc, checkNumber],
  );

  const queueRows = processing.data ?? [];

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
            ? `${stats.data.keyworded.toLocaleString()} keyworded · ${stats.data.processing.toLocaleString()} processing · ${stats.data.failed.toLocaleString()} failed · ${stats.data.total.toLocaleString()} total`
            : "Loading stats…"}
        </div>
        <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Auto-processing runs every minute
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
        <div style={{ fontSize: 10, marginTop: 8, opacity: 0.7 }}>
          Filename format: A + 8 digits + extension (e.g. A00010001.JPG)
        </div>
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
                    {it.status === "done" && it.imageNumber ? `#${String(it.imageNumber).padStart(8, "0")}` : it.status.toUpperCase()}
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
          Processing queue {queueRows.length ? `(${queueRows.length})` : ""}
        </h2>
        {processing.isLoading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : !queueRows.length ? (
          <div className="bi-placeholder">Queue empty — all uploaded images are keyworded</div>
        ) : (
          <div style={gridStyle}>
            {queueRows.map((r) => {
              const failed = !!r.processing_error;
              const stage = !r.preview_path ? "WAITING PREVIEW" : "WAITING KEYWORDS";
              return (
                <div key={r.id} style={tileStyle}>
                  <div style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}>
                    {r.signed_url ? (
                      <img src={r.signed_url} alt={r.filename} style={imgStyle} loading="lazy" />
                    ) : (
                      <div style={{ ...imgStyle, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#888" }}>
                        NO PREVIEW YET
                      </div>
                    )}
                    <span style={{ ...badgeStyle, background: "#000" }}>#{String(r.image_number).padStart(8, "0")}</span>
                    <span style={{ ...badgeStyle, background: failed ? "#D75F68" : "#666", left: "auto", right: 8 }}>
                      {failed ? "FAILED" : stage}
                    </span>
                  </div>
                  <div style={tileName} title={r.filename}>{r.filename}</div>
                  {failed && (
                    <>
                      <div style={errStyle}>{r.processing_error}</div>
                      <button
                        type="button"
                        style={retryBtn}
                        disabled={retryMut.isPending}
                        onClick={() => retryMut.mutate(r.id)}
                      >
                        {retryMut.isPending ? "…" : "Retry"}
                      </button>
                    </>
                  )}
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
const retryBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "#000",
  color: "#fff",
  border: "none",
  borderTop: "1px solid #000",
  cursor: "pointer",
};
