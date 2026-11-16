import { createFileRoute } from "@tanstack/react-router";

// The open pixel in every art director email: a transparent 1 x 1 GIF,
// logged against the email when the key and token are real.
const GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04,
  0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export const Route = createFileRoute("/api/public/o")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const { opened } = await import("@/lib/outreach.server");
          await opened(url.searchParams.get("k") ?? "", url.searchParams.get("t") ?? "");
        } catch (e) {
          console.error("Open pixel:", e);
        }
        return new Response(GIF, {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(GIF.length),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
      },
    },
  },
});
