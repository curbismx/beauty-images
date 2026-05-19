import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutRoot,
});

function AdminLayoutRoot() {
  return (
    <AuthProvider>
      <AdminLayout />
    </AuthProvider>
  );
}

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/library", label: "Library" },
  { to: "/admin/upload", label: "Upload" },
  { to: "/admin/sales", label: "Sales" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/settings", label: "Settings" },
] as const;

function AdminLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (!loading && !session && !isLogin) {
      navigate({ to: "/admin/login" });
    }
    if (!loading && session && isLogin) {
      navigate({ to: "/admin" });
    }
  }, [loading, session, isLogin, navigate]);

  return (
    <>
      <style>{adminCss}</style>
      <div className="bi-admin">
        {isLogin ? (
          <Outlet />
        ) : !session ? (
          <div className="bi-loading">…</div>
        ) : (
          <div className="bi-shell">
            <aside className="bi-sidebar">
              <div className="bi-brand">BEAUTYIMAGES</div>
              <nav className="bi-nav">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="bi-nav-link"
                    activeOptions={{ exact: item.to === "/admin" }}
                    activeProps={{ className: "bi-nav-link bi-nav-link--active" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <button className="bi-logout" onClick={() => signOut()}>
                Log out
              </button>
            </aside>
            <main className="bi-main">
              <Outlet />
            </main>
          </div>
        )}
      </div>
    </>
  );
}

const adminCss = `
.bi-admin, .bi-admin * { box-sizing: border-box; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
.bi-admin { min-height: 100vh; background: #fff; color: #000; }
.bi-loading { padding: 40px; font-size: 14px; text-transform: uppercase; }
.bi-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.bi-sidebar { background: #000; color: #fff; display: flex; flex-direction: column; padding: 28px 20px; position: sticky; top: 0; height: 100vh; }
.bi-brand { font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 40px; }
.bi-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.bi-nav-link { display: block; padding: 10px 0; color: #fff; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.bi-nav-link:hover { color: #D75F68; }
.bi-nav-link--active { color: #D75F68; }
.bi-logout { background: transparent; color: #fff; border: 1px solid #fff; padding: 12px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.bi-logout:hover { background: #fff; color: #000; }
.bi-main { padding: 56px 64px; background: #fff; }
.bi-title { font-size: clamp(32px, 5vw, 56px); font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; line-height: 0.95; margin: 0 0 24px; }
.bi-rule { border: 0; border-top: 4px solid #000; margin: 0 0 40px; }
.bi-input, .bi-textarea, .bi-select { width: 100%; border: 1px solid #000; padding: 12px 14px; font-size: 14px; background: #fff; color: #000; border-radius: 0; box-shadow: none; font-family: inherit; outline: none; }
.bi-input:focus, .bi-textarea:focus, .bi-select:focus { border-color: #D75F68; }
.bi-textarea { min-height: 120px; resize: vertical; }
.bi-label { display: block; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 8px; }
.bi-btn { background: #000; color: #fff; border: 1px solid #000; padding: 12px 18px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.bi-btn:hover { background: #fff; color: #000; }
.bi-btn--accent { background: #D75F68; border-color: #D75F68; color: #fff; }
.bi-btn--accent:hover { background: #fff; color: #D75F68; }
.bi-stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 48px; }
.bi-stat { border: 1px solid #000; padding: 24px; }
.bi-stat-label { font-size: 11px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 12px; }
.bi-stat-value { font-size: 32px; font-weight: 900; letter-spacing: -0.02em; }
.bi-section { margin-bottom: 48px; }
.bi-section-title { font-size: 16px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #000; }
.bi-placeholder { border: 1px solid #000; padding: 48px; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: #888; text-align: center; }
.bi-filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0 24px; }
.bi-filter-btn { background: #fff; color: #000; border: 1px solid #000; padding: 8px 14px; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.bi-filter-btn:hover, .bi-filter-btn--active { background: #000; color: #fff; }
.bi-grid-placeholder { border: 1px dashed #000; min-height: 400px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: #888; }
.bi-drop { border: 2px dashed #000; min-height: 320px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.bi-table-placeholder { border: 1px solid #000; min-height: 320px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: #888; }
.bi-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.bi-preview { border: 1px solid #000; min-height: 480px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; color: #888; }
.bi-field { margin-bottom: 20px; }
.bi-checkbox { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
.bi-login { min-height: 100vh; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; padding: 24px; }
.bi-login-form { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 16px; }
.bi-login-title { font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin: 0 0 8px; }
.bi-login-input { width: 100%; background: #000; color: #fff; border: 1px solid #fff; padding: 12px 14px; font-size: 14px; border-radius: 0; outline: none; font-family: inherit; }
.bi-login-input:focus { border-color: #D75F68; }
.bi-login-btn { background: #fff; color: #000; border: 1px solid #fff; padding: 14px; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; font-family: inherit; }
.bi-login-btn:hover { background: #D75F68; border-color: #D75F68; color: #fff; }
.bi-login-error { color: #D75F68; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
@media (max-width: 768px) {
  .bi-shell { grid-template-columns: 1fr; }
  .bi-sidebar { position: static; height: auto; flex-direction: row; align-items: center; gap: 16px; padding: 16px; }
  .bi-brand { margin: 0; }
  .bi-nav { flex-direction: row; flex-wrap: wrap; gap: 12px; }
  .bi-main { padding: 32px 20px; }
  .bi-stat-row { grid-template-columns: repeat(2, 1fr); }
  .bi-two-col { grid-template-columns: 1fr; gap: 24px; }
}
`;

export function PageHeader({ title }: { title: string }) {
  return (
    <>
      <h1 className="bi-title">{title}</h1>
      <hr className="bi-rule" />
    </>
  );
}
