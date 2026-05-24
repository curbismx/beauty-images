import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "./admin";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { regenerateAllPreviews, generateDerivativesBatch } from "@/lib/images.functions";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

function Settings() {
  const { session } = useAuth();
  const email = session?.user?.email ?? "";

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) {
      setMsg({ kind: "err", text: "New password must be at least 8 characters" });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ kind: "err", text: "Passwords do not match" });
      return;
    }
    if (!email) {
      setMsg({ kind: "err", text: "No active session" });
      return;
    }
    setBusy(true);
    // Re-verify current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: currentPw,
    });
    if (signInErr) {
      setBusy(false);
      setMsg({ kind: "err", text: "Current password is incorrect" });
      return;
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (updErr) {
      setMsg({ kind: "err", text: updErr.message });
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setMsg({ kind: "ok", text: "Password updated" });
  };

  const onSendResetEmail = async () => {
    if (!email) return;
    setResetMsg(null);
    setResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetBusy(false);
    setResetMsg(error ? error.message : "Reset email sent — check your inbox");
  };

  return (
    <>
      <PageHeader title="Settings" />

      <div className="bi-section">
        <h2 className="bi-section-title">Admin account</h2>
        <div className="bi-field">
          <label className="bi-label">Email</label>
          <input className="bi-input" value={email} readOnly />
        </div>

        <form onSubmit={onChangePassword}>
          <div className="bi-field">
            <label className="bi-label">Current password</label>
            <input
              className="bi-input"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">New password</label>
            <input
              className="bi-input"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Confirm new password</label>
            <input
              className="bi-input"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {msg && (
            <div
              className="bi-label"
              style={{ color: msg.kind === "ok" ? "#0a0" : "#D75F68", marginBottom: 12 }}
            >
              {msg.text}
            </div>
          )}
          <button className="bi-btn" type="submit" disabled={busy}>
            {busy ? "…" : "Update password"}
          </button>
        </form>

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="bi-btn"
            onClick={onSendResetEmail}
            disabled={resetBusy || !email}
          >
            {resetBusy ? "…" : "Send password reset email"}
          </button>
          {resetMsg && (
            <div className="bi-label" style={{ marginTop: 12 }}>
              {resetMsg}
            </div>
          )}
        </div>
      </div>

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

      <div className="bi-section">
        <h2 className="bi-section-title">Image previews</h2>
        <RegeneratePreviewsButton />
      </div>

      <div className="bi-section">
        <h2 className="bi-section-title">Image sizes</h2>
        <p className="bi-label" style={{ marginBottom: 12 }}>
          Pre-generate small, medium and thumbnail versions of every image so
          downloads and search are instant. Run once — keep this tab open and
          your computer awake until it finishes.
        </p>
        <GenerateDerivativesButton />
      </div>

      <button className="bi-btn">Save</button>
    </>
  );
}

function RegeneratePreviewsButton() {
  const regen = useServerFn(regenerateAllPreviews);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const onClick = async () => {
    if (!confirm("Regenerate all previews at 800px? Existing previews will be cleared and rebuilt on the next processing run.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await regen();
      setMsg(`Queued ${r.queued} image${r.queued === 1 ? "" : "s"} for preview regeneration.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" className="bi-btn" onClick={onClick} disabled={busy}>
        {busy ? "Queuing…" : "Regenerate all previews (800px)"}
      </button>
      {msg && <div className="bi-label" style={{ marginTop: 12 }}>{msg}</div>}
    </div>
  );
}

function GenerateDerivativesButton() {
  const runBatch = useServerFn(generateDerivativesBatch);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const onClick = async () => {
    if (running) return;
    if (
      !confirm(
        "Generate all image sizes? This works through the whole library and can take a few hours. Keep this tab open and your computer awake until it finishes.",
      )
    )
      return;
    setRunning(true);
    setFinished(false);
    setErrors([]);
    setDoneCount(0);
    let cursor = 0;
    let more = true;
    let iterations = 0;
    const allErrors: string[] = [];
    try {
      while (more && iterations < 20000) {
        iterations++;
        const r = await runBatch({ data: { afterImageNumber: cursor } });
        cursor = r.lastImageNumber;
        if (r.total) setTotal(r.total);
        setDoneCount((n) => n + r.processed + r.skipped);
        if (r.errors.length) {
          allErrors.push(...r.errors);
          setErrors([...allErrors]);
        }
        more = !r.done;
      }
      setFinished(true);
    } catch (e) {
      allErrors.push(`Stopped: ${(e as Error).message}`);
      setErrors([...allErrors]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <button type="button" className="bi-btn" onClick={onClick} disabled={running}>
        {running
          ? `Generating… ${doneCount}${total ? ` / ${total}` : ""}`
          : "Generate all sizes"}
      </button>
      {finished && !running && (
        <div className="bi-label" style={{ marginTop: 12 }}>
          Finished — {doneCount} image{doneCount === 1 ? "" : "s"} processed.
        </div>
      )}
      {errors.length > 0 && (
        <div className="bi-label" style={{ marginTop: 12, color: "#D75F68" }}>
          {errors.length} issue{errors.length === 1 ? "" : "s"}: {errors.slice(0, 5).join("; ")}
          {errors.length > 5 ? " …" : ""}
        </div>
      )}
    </div>
  );
}
