import { useState } from "react";
import type { UploadErrorItem } from "@/lib/images.functions";

export function UploadErrorCard({
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

export const uploadErrorGridStyle: React.CSSProperties = {
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
  background: "#000",
  color: "#fff",
  border: "none",
  borderTop: "1px solid #000",
  textTransform: "uppercase",
  cursor: "pointer",
};
