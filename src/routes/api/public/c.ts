import { createFileRoute } from "@tanstack/react-router";

// A tracked link in an art director email: logs the click, then sends the
// reader on to the real address. A link that isn't ours goes to the homepage.
export const Route = createFileRoute("/api/public/c")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        let to: string | null = null;
        try {
          const { clicked } = await import("@/lib/outreach.server");
          to = await clicked(url.searchParams.get("k") ?? "", url.searchParams.get("u") ?? "", url.searchParams.get("t") ?? "");
        } catch (e) {
          console.error("Click link:", e);
        }
        return new Response(null, {
          status: 302,
          headers: { Location: to ?? "https://beautyimages.com", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
