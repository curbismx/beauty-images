import { createFileRoute } from "@tanstack/react-router";

// The private link for the Curbism admin (curbism.com/admin). Every request
// must carry the CURBISM_LINK_KEY secret; the work runs in a server-only
// module so none of it reaches the browser.
export const Route = createFileRoute("/api/public/curbism")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCurbism } = await import("@/lib/curbism.server");
        return handleCurbism(request);
      },
    },
  },
});
