import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/upload")({
  component: Upload,
});

type QueueItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  message?: string;
  imageNumber?: number;
};

function Upload() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const items: QueueItem[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: "pending",
    }));
    setQueue((q) => [...items, ...q]);

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const item = items[i];
      setQueue((q) =>
        q.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it)),
      );
      try {
        const ext = file.name.split(".").pop() ?? "jpg";
        const storagePath = `${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("images-private")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (up.error) throw new Error(up.error.message);
        const ins = await supabase
          .from("images")
          .insert({ filename: file.name, storage_path: storagePath })
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
  }, []);

  return (
    <>
      <PageHeader title="Upload" />
      <div
        className="bi-drop"
        style={{ background: isDragging ? "#000" : undefined, color: isDragging ? "#fff" : undefined, cursor: "pointer" }}
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

      <div className="bi-section" style={{ marginTop: 32 }}>
        <h2 className="bi-section-title">Queue ({queue.length})</h2>
        {queue.length === 0 ? (
          <div className="bi-placeholder">Queue empty</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={th}>#</th>
                <th style={th}>File</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #000" }}>
                  <td style={td}>{it.imageNumber ?? "—"}</td>
                  <td style={td}>{it.name}</td>
                  <td style={{ ...td, color: it.status === "error" ? "#D75F68" : "#000" }}>
                    {it.status.toUpperCase()}
                    {it.message ? ` — ${it.message}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13 };
