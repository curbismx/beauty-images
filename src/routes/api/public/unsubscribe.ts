import { createFileRoute } from "@tanstack/react-router";

// The unsubscribe link under every art director email.
const page = (title: string, words: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.6 -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#1d1d1f;background:#fff}main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#6e6e73}</style></head>` +
      `<body><main><h1>${title}</h1><p>${words}</p></main></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

const handle = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const { unsubscribe } = await import("@/lib/outreach.server");
  const ok = await unsubscribe(url.searchParams.get("c") ?? "", url.searchParams.get("t") ?? "");
  return ok
    ? page("You're unsubscribed", "You won't hear from Beauty Images again.")
    : page("That link didn't work", "It may be old. Reply to the email instead and we'll take you off by hand.");
};

export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
