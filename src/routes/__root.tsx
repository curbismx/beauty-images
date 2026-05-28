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

import { SITE_NAME, BRAND_TAGLINE, organizationJsonLd } from "@/lib/seo";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // Root-level title/description are defaults; every public leaf route
      // overrides them with bespoke copy via its own head().
      { title: "Premium Beauty Photography Licensing | Beauty Images" },
      { name: "description", content: BRAND_TAGLINE },
      { name: "theme-color", content: "#000000" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Premium Beauty Photography Licensing | Beauty Images" },
      { property: "og:description", content: BRAND_TAGLINE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Premium Beauty Photography Licensing | Beauty Images" },
      { name: "twitter:description", content: BRAND_TAGLINE },
      // NOTE: do NOT set og:image / twitter:image at the root — TanStack
      // concatenates `meta` and the root value would override every leaf.
      { property: "og:image", content: "https://beautyimages.com/beautyimagessocial.jpg" },
      { name: "twitter:image", content: "https://beautyimages.com/beautyimagessocial.jpg" },
      { name: "apple-mobile-web-app-title", content: "Beauty Images" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@400;500;600;700;800;900&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationJsonLd()),
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

    // Stable per-tab session id, so page views can be grouped into one visit.
    let sid = sessionStorage.getItem("bi_sid");
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem("bi_sid", sid);
    }

    // Don't double-log the same path back-to-back (React re-renders).
    if (sessionStorage.getItem("bi_last_path") === pathname) return;
    sessionStorage.setItem("bi_last_path", pathname);

    fetch("/api/public/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referer: document.referrer || null,
        sessionId: sid,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
