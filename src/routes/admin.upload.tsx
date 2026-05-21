import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";
import {
  getImageStats,
  getProcessingQueue,
  retryImageProcessing,
  retryAllFailedImages,
  listUploadErrors,
  deleteUploadErrors,
  resolveUploadError,
  type UploadErrorItem,
} from "@/lib/images.functions";

export const Route = createFileRoute("/admin/upload")({
  component: Upload,
});

const FILENAME_RE = /^a(\d{8})\.[a-z0-9]+$/i;
const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif)$/i;

type WebkitEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error?: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      success: (entries: WebkitEntry[]) => void,
      error?: (err: unknown) => void,
    ) => void;
  };
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => WebkitEntry | null;
};

function isImageFile(file: File) {
  return file.type.startsWith("image/") || IMAGE_FILE_RE.test(file.name);
}

async function filesFromEntry(entry: WebkitEntry): Promise<File[]> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file?.(resolve, (err) =>
        reject(err instanceof Error ? err : new Error("Could not read dropped file")),
      );
    });
    return isImageFile(file) ? [file] : [];
  }

  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const entries: WebkitEntry[] = [];
  await new Promise<void>((resolve, reject) => {
    const readNext = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve();
            return;
          }
          entries.push(...batch);
          readNext();
        },
        (err) => reject(err instanceof Error ? err : new Error("Could not read dropped folder")),
      );
    };
    readNext();
  });

  const files: File[] = [];
  for (const child of entries) files.push(...(await filesFromEntry(child)));
  return files;
}

async function collectDroppedImageFiles(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []) as DataTransferItemWithEntry[];
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean) as WebkitEntry[];
  const files = entries.length
    ? (await Promise.all(entries.map(filesFromEntry))).flat()
    : Array.from(dataTransfer.files).filter(isImageFile);
  const rawCount = entries.length || dataTransfer.files.length;
  return { files, ignored: Math.max(0, rawCount - files.length) };
}

function extensionFor(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "jpg";
}

type QueueItem = {
  id: string;
  file: File;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  imageNumber?: number;
};

const MAX_CONCURRENT = 4;
const VISIBLE_TILES = 100;

function Upload() {
  // Single shared queue across all drops. Keep the visible list capped, but
  // track counts on the full set so big batches don't blow up the DOM.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [totals, setTotals] = useState({ done: 0, failed: 0, queued: 0, uploading: 0 });
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Pipeline state — refs so we don't re-render on every queued file.
  const pendingRef = useRef<QueueItem[]>([]);
  const activeRef = useRef(0);
  const runningRef = useRef(false);

  const fetchQueue = useServerFn(getProcessingQueue);
  const [failedOnly, setFailedOnly] = useState(false);
  const processing = useQuery({
    queryKey: ["processing-queue", failedOnly],
    queryFn: () => fetchQueue({ data: { limit: 300, failedOnly } }),
    refetchInterval: 15_000,
  });

  const fetchStats = useServerFn(getImageStats);
  const stats = useQuery({
    queryKey: ["image-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 15_000,
  });

  const fetchUploadErrors = useServerFn(listUploadErrors);
  const removeUploadErrors = useServerFn(deleteUploadErrors);
  const fixUploadError = useServerFn(resolveUploadError);
  const runRetry = useServerFn(retryImageProcessing);
  const runRetryAll = useServerFn(retryAllFailedImages);

  const uploadErrors = useQuery({
    queryKey: ["upload-errors"],
    queryFn: () => fetchUploadErrors({ data: { limit: 300 } }),
    refetchInterval: 15_000,
  });


  const deleteUploadErrorMut = useMutation({
    mutationFn: (id: string) => removeUploadErrors({ data: { ids: [id] } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upload-errors"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });

  const resolveUploadErrorMut = useMutation({
    mutationFn: ({ id, image_number }: { id: string; image_number: number }) =>
      fixUploadError({ data: { id, image_number } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upload-errors"] });
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });
  const retryMut = useMutation({
    mutationFn: (id: string) => runRetry({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });
  const retryAllMut = useMutation({
    mutationFn: () => runRetryAll({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
    },
  });

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => {
      const idx = q.findIndex((it) => it.id === id);
      if (idx === -1) return q;
      const next = q.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const processOne = useCallback(
    async (item: QueueItem): Promise<boolean> => {
      const file = item.file;
      updateItem(item.id, { status: "uploading" });
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please log in again before uploading");

        const body = new FormData();
        body.append("file", file, file.name);
        body.append("filename", file.name);

        const response = await fetch("/api/admin/upload-image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        const result = (await response.json().catch(() => null)) as
          | { ok: true; imageNumber: number }
          | { ok: false; message?: string }
          | null;

        if (!response.ok || !result) {
          const message = result && "message" in result ? result.message : null;
          throw new Error(message || `Upload request failed (${response.status})`);
        }
        if (!result.ok) {
          updateItem(item.id, { status: "error", message: result.message || "Upload failed" });
          return false;
        }

        updateItem(item.id, { status: "done", imageNumber: result.imageNumber });
        return true;
      } catch (e) {
        updateItem(item.id, { status: "error", message: (e as Error).message });
        return false;
      }
    },
    [updateItem],
  );

  const drainPipeline = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (pendingRef.current.length > 0 || activeRef.current > 0) {
        while (activeRef.current < MAX_CONCURRENT && pendingRef.current.length > 0) {
          const next = pendingRef.current.shift()!;
          activeRef.current += 1;
          setTotals((t) => ({
            ...t,
            queued: pendingRef.current.length,
            uploading: activeRef.current,
          }));
          processOne(next)
            .then((ok) => {
              setTotals((t) => ({
                ...t,
                done: t.done + (ok ? 1 : 0),
                failed: t.failed + (ok ? 0 : 1),
              }));
            })
            .finally(() => {
              activeRef.current -= 1;
              setTotals((t) => ({
                ...t,
                queued: pendingRef.current.length,
                uploading: activeRef.current,
              }));
            });
        }
        // Yield so React can render and newly-dropped files can join the pipeline.
        await new Promise((r) => setTimeout(r, 80));
      }
    } finally {
      runningRef.current = false;
      qc.invalidateQueries({ queryKey: ["processing-queue"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
      qc.invalidateQueries({ queryKey: ["upload-errors"] });
    }
  }, [processOne, qc]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter(isImageFile);
      if (!arr.length) {
        setDropMessage(
          "No image files found — open the folder and select/drop the images inside it.",
        );
        return;
      }
      setDropMessage(null);
      const items: QueueItem[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        name: f.name,
        status: "pending",
      }));
      // Cap the visible queue so the DOM stays small on huge batches.
      // The upload itself still references the File object via pendingRef.
      setQueue((q) => {
        const merged = [...items, ...q];
        if (merged.length > VISIBLE_TILES) return merged.slice(0, VISIBLE_TILES);
        return merged;
      });
      pendingRef.current.push(...items);
      setTotals((t) => ({ ...t, queued: pendingRef.current.length }));
      void drainPipeline();
    },
    [drainPipeline],
  );

  const queueRows = processing.data ?? [];
  const failedCount = stats.data?.failed ?? queueRows.filter((r) => !!r.processing_error).length;

  return (
    <>
      <PageHeader title="Upload" />

      {failedCount > 0 && (
        <div style={failedActionBar}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{failedCount} failed image{failedCount === 1 ? "" : "s"}</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>These are the images that timed out or failed during processing.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={failedActionButtonLight}
              onClick={() => {
                setFailedOnly(true);
                window.setTimeout(() => document.getElementById("processing-queue")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
            >
              View failed images
            </button>
            <button
              type="button"
              style={failedActionButtonDark}
              disabled={retryAllMut.isPending}
              onClick={() => {
                if (confirm(`Retry all ${failedCount} failed image${failedCount === 1 ? "" : "s"}?`)) {
                  retryAllMut.mutate();
                }
              }}
            >
              {retryAllMut.isPending ? "Retrying…" : `Retry failed images (${failedCount})`}
            </button>
          </div>
        </div>
      )}

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
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {stats.data
            ? `${stats.data.keyworded.toLocaleString()} keyworded · ${stats.data.published.toLocaleString()} published · ${stats.data.processing.toLocaleString()} processing · ${stats.data.failed.toLocaleString()} failed · ${stats.data.upload_errors.toLocaleString()} upload errors · ${stats.data.total.toLocaleString()} total`
            : "Loading stats…"}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#666",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {totals.queued > 0 || totals.uploading > 0
            ? `Uploading · ${totals.uploading} in flight · ${totals.queued} queued · ${totals.done} done · ${totals.failed} failed`
            : stats.data && stats.data.processing > 0
              ? `Keywording runs automatically · ~600/hour · ${stats.data.processing} left`
              : "Keywording runs automatically in the background"}
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
          void collectDroppedImageFiles(e.dataTransfer)
            .then(({ files, ignored }) => {
              if (ignored > 0)
                setDropMessage(
                  `${ignored} non-image/folder item${ignored === 1 ? "" : "s"} ignored`,
                );
              handleFiles(files);
            })
            .catch((err) => setDropMessage((err as Error).message));
        }}
      >
        Drop images here or click to browse
        <div style={{ fontSize: 10, marginTop: 8, opacity: 0.7 }}>
          Filename format: A + 8 digits + extension (e.g. A00010001.JPG)
        </div>
        {dropMessage && (
          <div style={{ fontSize: 11, marginTop: 8, color: "#D75F68", fontWeight: 800 }}>
            {dropMessage}
          </div>
        )}
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

      <div id="processing-queue" className="bi-section" style={{ marginTop: 32, scrollMarginTop: 20 }}>
        <h2 className="bi-section-title">
          Upload errors {uploadErrors.data?.length ? `(${uploadErrors.data.length})` : ""}
        </h2>
        {uploadErrors.isLoading ? (
          <div className="bi-placeholder">Loading errors…</div>
        ) : !uploadErrors.data?.length ? (
          <div className="bi-placeholder">No upload errors</div>
        ) : (
          <div style={gridStyle}>
            {uploadErrors.data.map((err) => (
              <UploadErrorCard
                key={err.id}
                err={err}
                deleting={deleteUploadErrorMut.isPending}
                resolving={resolveUploadErrorMut.isPending}
                onDelete={() => {
                  if (confirm(`Delete error file ${err.filename}?`))
                    deleteUploadErrorMut.mutate(err.id);
                }}
                onResolve={(image_number) =>
                  resolveUploadErrorMut.mutate({ id: err.id, image_number })
                }
              />
            ))}
          </div>
        )}
        {deleteUploadErrorMut.data && (
          <div style={notice}>Deleted {deleteUploadErrorMut.data.deleted} error file.</div>
        )}
        {resolveUploadErrorMut.data && (
          <div style={notice}>
            Moved #{String(resolveUploadErrorMut.data.image_number).padStart(8, "0")} into the
            processing queue.
          </div>
        )}
        {resolveUploadErrorMut.error && (
          <div style={errBox}>{(resolveUploadErrorMut.error as Error).message}</div>
        )}
      </div>

      {(queue.length > 0 || totals.uploading > 0 || totals.queued > 0) && (
        <div className="bi-section" style={{ marginTop: 32 }}>
          <h2 className="bi-section-title">
            This session · {totals.done} done · {totals.failed} failed · {totals.uploading}{" "}
            uploading · {totals.queued} queued
            {queue.length >= VISIBLE_TILES ? ` (showing latest ${VISIBLE_TILES})` : ""}
          </h2>
          <div style={gridStyle}>
            {queue.map((it) => (
              <div key={it.id} style={tileStyle}>
                <div style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}>
                  <div
                    style={{
                      ...imgStyle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 12,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#666",
                      wordBreak: "break-word",
                    }}
                  >
                    {it.name}
                  </div>
                  <span style={{ ...badgeStyle, background: statusColor(it.status) }}>
                    {it.status === "done" && it.imageNumber
                      ? `#${String(it.imageNumber).padStart(8, "0")}`
                      : it.status.toUpperCase()}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 className="bi-section-title" style={{ margin: 0 }}>
            Processing queue {queueRows.length ? `(${queueRows.length}${failedOnly ? " failed" : ""})` : ""}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setFailedOnly((v) => !v)}
              style={{
                ...retryBtn,
                width: "auto",
                background: failedOnly ? "#D75F68" : "#fff",
                color: failedOnly ? "#fff" : "#000",
                border: "1px solid #000",
              }}
            >
              {failedOnly ? `Showing failed (${failedCount})` : `Show failed only (${failedCount})`}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!failedCount) return;
                if (confirm(`Retry all ${failedCount} failed image${failedCount === 1 ? "" : "s"}?`)) {
                  retryAllMut.mutate();
                }
              }}
              disabled={!failedCount || retryAllMut.isPending}
              style={{ ...retryBtn, width: "auto", opacity: !failedCount ? 0.4 : 1 }}
            >
              {retryAllMut.isPending ? "Retrying…" : `Retry all failed${failedCount ? ` (${failedCount})` : ""}`}
            </button>
          </div>
        </div>
        {retryAllMut.data && (
          <div style={notice}>Queued {retryAllMut.data.retried} failed image{retryAllMut.data.retried === 1 ? "" : "s"} for retry.</div>
        )}
        {processing.isLoading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : !queueRows.length ? (
          <div className="bi-placeholder">{failedOnly ? "No failed images" : "Queue empty — all uploaded images are keyworded"}</div>
        ) : (
          <div style={gridStyle}>
            {queueRows.map((r) => {
              const failed = !!r.processing_error;
              const stage = !r.preview_path ? "WAITING PREVIEW" : "WAITING KEYWORDS";
              return (
                <div key={r.id} style={tileStyle}>
                  <div
                    style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}
                  >
                    {r.signed_url ? (
                      <img src={r.signed_url} alt={r.filename} style={imgStyle} loading="lazy" />
                    ) : (
                      <div
                        style={{
                          ...imgStyle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#888",
                        }}
                      >
                        NO PREVIEW YET
                      </div>
                    )}
                    <span style={{ ...badgeStyle, background: "#000" }}>
                      #{String(r.image_number).padStart(8, "0")}
                    </span>
                    <span
                      style={{
                        ...badgeStyle,
                        background: failed ? "#D75F68" : "#666",
                        left: "auto",
                        right: 8,
                      }}
                    >
                      {failed ? "FAILED" : stage}
                    </span>
                  </div>
                  <div style={tileName} title={r.filename}>
                    {r.filename}
                  </div>
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

function UploadErrorCard({
  err,
  deleting,
  resolving,
  onDelete,
  onResolve,
}: {
  err: UploadErrorItem;
  deleting: boolean;
  resolving: boolean;
  onDelete: () => void;
  onResolve: (image_number: number) => void;
}) {
  const [numberText, setNumberText] = useState(
    err.detected_image_number ? String(err.detected_image_number).padStart(8, "0").slice(-8) : "",
  );
  const parsed = /^\d{8}$/.test(numberText) ? parseInt(numberText, 10) : null;
  return (
    <div style={tileStyle}>
      <div style={{ position: "relative", paddingBottom: "100%", background: "#f4f4f4" }}>
        {err.signed_url ? (
          <img src={err.signed_url} alt={err.filename} style={imgStyle} loading="lazy" />
        ) : (
          <div
            style={{
              ...imgStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              color: "#888",
            }}
          >
            NO FILE SAVED
          </div>
        )}
        <span style={{ ...badgeStyle, background: "#D75F68" }}>ERROR</span>
      </div>
      <div style={tileName} title={err.filename}>
        {err.filename}
      </div>
      <div style={errStyle}>{err.error_message}</div>
      {err.storage_path && (
        <div style={{ padding: 10, borderTop: "1px solid #000" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Correct 8-digit number
          </div>
          <input
            value={numberText}
            maxLength={8}
            onChange={(e) => setNumberText(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="00010001"
            style={{
              width: "100%",
              border: "1px solid #000",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 800,
            }}
          />
          <button
            type="button"
            style={{ ...retryBtn, marginTop: 8 }}
            disabled={!parsed || resolving}
            onClick={() => parsed && onResolve(parsed)}
          >
            {resolving ? "…" : "Save corrected number"}
          </button>
        </div>
      )}
      <button
        type="button"
        style={{ ...retryBtn, background: "#a32020" }}
        disabled={deleting}
        onClick={onDelete}
      >
        {deleting ? "…" : "Delete error"}
      </button>
    </div>
  );
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
const notice: React.CSSProperties = {
  padding: "8px 12px",
  background: "#f4f4f4",
  border: "1px solid #000",
  marginTop: 12,
  fontSize: 12,
};
const failedActionBar: React.CSSProperties = {
  border: "2px solid #D75F68",
  background: "#fff5f6",
  color: "#000",
  padding: 16,
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};
const failedActionButtonDark: React.CSSProperties = {
  width: "auto",
  background: "#000",
  color: "#fff",
  border: "1px solid #000",
  borderTop: "1px solid #000",
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const failedActionButtonLight: React.CSSProperties = {
  ...failedActionButtonDark,
  background: "#fff",
  color: "#000",
};
const errBox: React.CSSProperties = {
  ...notice,
  color: "#D75F68",
  borderColor: "#D75F68",
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
