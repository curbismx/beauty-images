import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Opened by the Curbism admin (curbism.com/admin) in a new window: signs the
// admin in with the one-time token it was handed, then goes to the admin
// page that was asked for. Anything else lands on the normal admin sign-in.

const ADMIN_PAGES = new Set([
  "/admin",
  "/admin/library",
  "/admin/upload",
  "/admin/featured",
  "/admin/agents",
  "/admin/sales",
  "/admin/customers",
  "/admin/settings",
]);

export const Route = createFileRoute("/admin-sso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — Beauty Images" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSso,
});

function AdminSso() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t") ?? "";
    const asked = params.get("next") ?? "/admin";
    const next = ADMIN_PAGES.has(asked) ? asked : "/admin";
    // Take the token out of the address bar straight away.
    window.history.replaceState(null, "", "/admin-sso");

    if (!token) {
      navigate({ to: "/admin/login" });
      return;
    }
    supabase.auth.verifyOtp({ type: "email", token_hash: token }).then(({ error }) => {
      if (error) {
        setFailed(true);
        return;
      }
      window.location.replace(next);
    });
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        color: "#555",
        textAlign: "center",
        padding: 24,
      }}
    >
      {failed ? (
        <div>
          That sign-in link has expired.
          <br />
          <a href="/admin/login" style={{ color: "#000", fontWeight: 700 }}>
            Sign in here
          </a>{" "}
          or open it again from the Curbism admin.
        </div>
      ) : (
        "Signing you in…"
      )}
    </div>
  );
}
