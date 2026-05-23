import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

const errCss = `
.bi-err { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fff; color: #111; padding: 24px; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
.bi-err-inner { max-width: 520px; text-align: center; }
.bi-err-code { font-size: clamp(96px, 22vw, 200px); font-weight: 900; line-height: 0.82; letter-spacing: -0.04em; margin: 0; color: #111; }
.bi-err-code span { color: #D75F68; }
.bi-err-title { font-size: 15px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; margin: 22px 0 0; color: #111; }
.bi-err-text { font-size: 14px; line-height: 1.6; color: #6b6b6b; margin: 14px 0 0; }
.bi-err-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 30px; }
.bi-err-btn { display: inline-flex; align-items: center; justify-content: center; padding: 13px 22px; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none; cursor: pointer; border: 1px solid #111; font-family: inherit; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
.bi-err-btn--solid { background: #111; color: #fff; }
.bi-err-btn--solid:hover { background: #D75F68; border-color: #D75F68; color: #fff; }
.bi-err-btn--ghost { background: #fff; color: #111; }
.bi-err-btn--ghost:hover { background: #111; color: #fff; }
`;

function NotFoundComponent() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: errCss }} />
      <div className="bi-err">
        <div className="bi-err-inner">
          <p className="bi-err-code">4<span>0</span>4</p>
          <h1 className="bi-err-title">Page not found</h1>
          <p className="bi-err-text">
            The page you're looking for doesn't exist or has moved.
          </p>
          <div className="bi-err-actions">
            <Link to="/" className="bi-err-btn bi-err-btn--solid">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: errCss }} />
      <div className="bi-err">
        <div className="bi-err-inner">
          <p className="bi-err-code"><span>!</span></p>
          <h1 className="bi-err-title">Something went wrong</h1>
          <p className="bi-err-text">
            This page didn't load. You can try again, or head back home.
          </p>
          <div className="bi-err-actions">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="bi-err-btn bi-err-btn--solid"
            >
              Try again
            </button>
            <a href="/" className="bi-err-btn bi-err-btn--ghost">
              Back to home
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "CURBISM Workspace is a brutalist portfolio website showcasing photography and bold typography." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "CURBISM Workspace is a brutalist portfolio website showcasing photography and bold typography." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "CURBISM Workspace is a brutalist portfolio website showcasing photography and bold typography." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8039cc29-e92a-4261-854b-69c831523762/id-preview-db1ccd8a--ffd54b53-1237-4d4e-8429-044a901aabd6.lovable.app-1779132524496.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8039cc29-e92a-4261-854b-69c831523762/id-preview-db1ccd8a--ffd54b53-1237-4d4e-8429-044a901aabd6.lovable.app-1779132524496.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/admin")) return;
    const key = `bi_track_${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/public/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname, referer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
