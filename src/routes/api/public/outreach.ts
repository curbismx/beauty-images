import { createFileRoute } from "@tanstack/react-router";

// The art director emails' hourly run, at /api/public/outreach: the next few
// from the queue, then a look in the mailbox for bounces. The database's
// clock calls it every hour on weekdays; the Curbism admin can call it too.
// It is safe to call at any time: it never sends past the daily limit, and
// a call too soon after the last does nothing.
const handle = async () => {
  const { run } = await import("@/lib/outreach.server");
  const result = await run();
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};

export const Route = createFileRoute("/api/public/outreach")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
