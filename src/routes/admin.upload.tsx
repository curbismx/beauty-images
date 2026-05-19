import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/upload")({
  component: Upload,
});

function Upload() {
  return (
    <>
      <PageHeader title="Upload" />
      <div className="bi-drop">Drag images here</div>
      <div className="bi-section" style={{ marginTop: 32 }}>
        <h2 className="bi-section-title">Queue</h2>
        <div className="bi-placeholder">Queue empty</div>
      </div>
    </>
  );
}
