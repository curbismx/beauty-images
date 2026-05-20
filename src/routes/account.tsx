import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { authPageCss } from "@/lib/auth-css";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — BEAUTYIMAGES" }] }),
  component: AccountPage,
});

type Sale = {
  id: string;
  amount: number | null;
  currency: string;
  created_at: string;
  usage_type: string | null;
  status: string;
};

function AccountPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    setEmail(session.user.email ?? "");
    let alive = true;
    (async () => {
      const [{ data: profile }, { data: salesData }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle(),
        supabase.from("sales").select("id, amount, currency, created_at, usage_type, status").eq("user_id", session.user.id).order("created_at", { ascending: false }),
      ]);
      if (!alive) return;
      if (profile?.full_name) setName(profile.full_name);
      setSales(salesData ?? []);
    })();
    return () => { alive = false; };
  }, [session, loading, navigate]);

  const saveName = async () => {
    if (!session) return;
    await supabase.from("profiles").update({ full_name: name }).eq("id", session.user.id);
  };


  const changePassword = async () => {
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ kind: "err", text: "Password must be at least 8 characters." });
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (error) setPwMsg({ kind: "err", text: error.message });
    else {
      setNewPassword("");
      setPwMsg({ kind: "ok", text: "Password updated." });
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !session) {
    return (
      <>
        <style>{authPageCss}</style>
        <div className="auth-page"><div style={{ fontSize: 12, letterSpacing: "0.15em" }}>…</div></div>
      </>
    );
  }

  return (
    <>
      <style>{authPageCss + accountCss}</style>
      <div className="auth-page acct-page">
        <Link to="/" className="auth-home">← BEAUTYIMAGES</Link>
        <div className="acct-card">
          <div className="auth-title">My Account</div>

          <div className="acct-section">
            <label className="acct-label">Name</label>
            <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          </div>

          <div className="acct-section">
            <label className="acct-label">Email</label>
            <input className="auth-input" value={email} disabled />
          </div>

          <div className="acct-section">
            <label className="acct-label">Change password</label>
            <input className="auth-input" type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            {pwMsg && <div className={pwMsg.kind === "ok" ? "acct-ok" : "auth-error"}>{pwMsg.text}</div>}
            <button type="button" className="auth-btn" onClick={changePassword} disabled={pwBusy || !newPassword}>{pwBusy ? "…" : "Update password"}</button>
          </div>


          <div className="acct-section">
            <div className="acct-label">Past purchases</div>
            {sales.length === 0 ? (
              <div className="acct-empty">No purchases yet.</div>
            ) : (
              <ul className="acct-sales">
                {sales.map((s) => (
                  <li key={s.id}>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                    <span>{s.usage_type ?? "License"}</span>
                    <span>{s.currency} {Number(s.amount ?? 0).toFixed(2)}</span>
                    <span className="acct-status">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button className="auth-btn acct-logout" onClick={logout}>Log out</button>
        </div>
      </div>
    </>
  );
}

const accountCss = `
.acct-page { align-items: flex-start; padding-top: 80px; }
.acct-card { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 18px; }
.acct-section { display: flex; flex-direction: column; gap: 6px; }
.acct-label { font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #999; }
.acct-empty { font-size: 12px; color: #777; padding: 12px 0; }
.acct-sales { list-style: none; padding: 0; margin: 0; border: 1px solid #333; }
.acct-sales li { display: grid; grid-template-columns: 1fr 1fr 1fr 80px; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #222; font-size: 12px; }
.acct-sales li:last-child { border-bottom: 0; }
.acct-status { color: #D75F68; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; font-size: 10px; align-self: center; }
.acct-logout { margin-top: 12px; background: transparent; color: #fff; border-color: #fff; }
.acct-logout:hover { background: #D75F68; border-color: #D75F68; color: #fff; }
.acct-ok { color: #6ec77a; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
`;
