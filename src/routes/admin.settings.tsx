import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

function Settings() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="bi-section">
        <h2 className="bi-section-title">Stripe</h2>
        <div className="bi-field">
          <label className="bi-label">Publishable key</label>
          <input className="bi-input" placeholder="pk_…" />
        </div>
        <div className="bi-field">
          <label className="bi-label">Secret key</label>
          <input className="bi-input" type="password" placeholder="sk_…" />
        </div>
      </div>
      <div className="bi-section">
        <h2 className="bi-section-title">Gemini API key</h2>
        <div className="bi-field">
          <label className="bi-label">API key</label>
          <input className="bi-input" type="password" placeholder="…" />
        </div>
      </div>
      <div className="bi-section">
        <h2 className="bi-section-title">Pricing tiers</h2>
        <div className="bi-placeholder">No tiers configured</div>
      </div>
      <button className="bi-btn">Save</button>
    </>
  );
}
