import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "./admin";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { regenerateAllPreviews, getDerivativeJobs, getImageSource, storeDerivatives, getJobsByNumbers } from "@/lib/images.functions";

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
        <div style={{ marginTop: 24 }}>
          <RetryDerivativesButton />
        </div>
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
  const fetchJobs = useServerFn(getDerivativeJobs);
  const fetchSource = useServerFn(getImageSource);
  const storeJob = useServerFn(storeDerivatives);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const b64ToBlob = (b64: string): Blob => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  };

  const resizeToBase64 = async (
    blob: Blob,
    maxEdge: number,
    quality: number,
  ): Promise<string> => {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
        "image/jpeg",
        quality,
      );
    });
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(out);
    });
    return dataUrl.split(",")[1];
  };

  const onClick = async () => {
    if (running) return;
    if (
      !confirm(
        "Generate all image sizes? Your browser will resize every image - this can take a while. Keep this tab open and your computer awake until it finishes.",
      )
    )
      return;
    setRunning(true);
    setFinished(false);
    setErrors([]);
    setDoneCount(0);
    let cursor = 0;
    let more = true;
    let guard = 0;
    const allErrors: string[] = [];
    const CONCURRENCY = 5;
    const processJob = async (job: {
      id: string;
      imageNumber: number;
      hasPreview: boolean;
      alreadyDone: boolean;
    }) => {
      try {
        if (!job.alreadyDone) {
          const src = await fetchSource({ data: { imageId: job.id } });
          if (!src.original) throw new Error("master file missing");
          const originalBlob = b64ToBlob(src.original);
          const medium = await resizeToBase64(originalBlob, 2000, 0.88);
          const small = await resizeToBase64(originalBlob, 800, 0.88);
          let thumb: string | null = null;
          if (src.preview) {
            thumb = await resizeToBase64(b64ToBlob(src.preview), 500, 0.82);
          }
          await storeJob({ data: { imageId: job.id, medium, small, thumb } });
        }
        setDoneCount((n) => n + 1);
      } catch (e) {
        allErrors.push(`#${job.imageNumber}: ${(e as Error).message}`);
        setErrors([...allErrors]);
      }
    };
    try {
      while (more && guard < 100000) {
        guard += 1;
        const batch = await fetchJobs({ data: { afterImageNumber: cursor } });
        if (batch.total) setTotal(batch.total);
        cursor = batch.lastImageNumber;
        for (let i = 0; i < batch.jobs.length; i += CONCURRENCY) {
          await Promise.all(batch.jobs.slice(i, i + CONCURRENCY).map(processJob));
        }
        more = !batch.done;
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
        <div className="bi-label" style={{ marginTop: 12, color: "#0a0" }}>
          Finished — {doneCount} image{doneCount === 1 ? "" : "s"} done.
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

function RetryDerivativesButton() {
  const fetchJobsByNumbers = useServerFn(getJobsByNumbers);
  const fetchSource = useServerFn(getImageSource);
  const storeJob = useServerFn(storeDerivatives);
  const [numbersText, setNumbersText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  const b64ToBlob = (b64: string): Blob => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  };

  const resizeToBase64 = async (
    blob: Blob,
    maxEdge: number,
    quality: number,
  ): Promise<string> => {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
        "image/jpeg",
        quality,
      );
    });
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Read failed"));
      reader.readAsDataURL(out);
    });
    return dataUrl.split(",")[1];
  };

  const processOne = async (job: { id: string; hasPreview: boolean }) => {
    const src = await fetchSource({ data: { imageId: job.id } });
    if (!src.original) throw new Error("master file missing");
    const originalBlob = b64ToBlob(src.original);
    const medium = await resizeToBase64(originalBlob, 2000, 0.88);
    const small = await resizeToBase64(originalBlob, 800, 0.88);
    let thumb: string | null = null;
    if (src.preview) {
      thumb = await resizeToBase64(b64ToBlob(src.preview), 500, 0.82);
    }
    await storeJob({ data: { imageId: job.id, medium, small, thumb } });
  };

  const onClick = async () => {
    if (running) return;
    const numbers = numbersText
      .split(/[^0-9]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (numbers.length === 0) {
      setResult("Enter one or more image numbers first.");
      return;
    }
    setRunning(true);
    setResult("Working…");
    try {
      const jobs = await fetchJobsByNumbers({ data: { imageNumbers: numbers } });
      let ok = 0;
      const failed: string[] = [];
      for (const job of jobs) {
        let lastErr = "";
        let success = false;
        for (let attempt = 0; attempt < 3 && !success; attempt += 1) {
          try {
            await processOne(job);
            success = true;
          } catch (e) {
            lastErr = (e as Error).message;
          }
        }
        if (success) ok += 1;
        else failed.push(`#${job.imageNumber}: ${lastErr}`);
        setResult(`Working… ${ok + failed.length} of ${jobs.length}`);
      }
      const found = jobs.map((j) => j.imageNumber);
      const missing = numbers.filter((n) => !found.includes(n));
      let msg = `Done — ${ok} fixed`;
      if (failed.length) msg += `; ${failed.length} still failing: ${failed.join("; ")}`;
      if (missing.length) msg += `. Not found: ${missing.join(", ")}`;
      setResult(msg);
    } catch (e) {
      setResult(`Stopped: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <label className="bi-label" style={{ display: "block", marginBottom: 8 }}>
        Retry specific images (paste image numbers, separated by spaces or commas)
      </label>
      <input
        className="bi-input"
        value={numbersText}
        onChange={(e) => setNumbersText(e.target.value)}
        placeholder="e.g. 1490047, 1490062, 1510017"
        disabled={running}
        style={{ marginBottom: 8 }}
      />
      <button type="button" className="bi-btn" onClick={onClick} disabled={running}>
        {running ? "Retrying…" : "Retry these images"}
      </button>
      {result && (
        <div className="bi-label" style={{ marginTop: 12 }}>
          {result}
        </div>
      )}
    </div>
  );
}
