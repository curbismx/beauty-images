import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Beauty Images" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Password must be at least 8 characters");
    if (pw !== confirm) return setError("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate({ to: "/admin" }), 1500);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          Set new password
        </div>
        {!ready && <div style={{ fontSize: 12 }}>Validating reset link…</div>}
        {done ? (
          <div style={{ fontSize: 12 }}>Password updated. Redirecting…</div>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            {error && (
              <div style={{ color: "#D75F68", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !ready}
              style={{
                background: "#fff",
                color: "#000",
                border: "1px solid #fff",
                padding: 14,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {busy ? "…" : "Update password"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#000",
  color: "#fff",
  border: "1px solid #fff",
  padding: "12px 14px",
  fontSize: 14,
  borderRadius: 0,
  outline: "none",
  fontFamily: "inherit",
};
