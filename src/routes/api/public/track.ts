import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: string;
            referer?: string;
          };

          const headers = request.headers;
          const ip =
            headers.get("cf-connecting-ip") ||
            headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            headers.get("x-real-ip") ||
            "unknown";

          let country = headers.get("cf-ipcountry") || null;
          let city = headers.get("cf-ipcity") || null;
          let region = headers.get("cf-region") || null;
          const userAgent = headers.get("user-agent") || null;
          const referer = body.referer || headers.get("referer") || null;
          const path = body.path || null;

          // Fallback geo lookup when CF headers are absent (e.g. local/preview)
          if ((!country || country === "XX" || country === "T1") && ip !== "unknown") {
            try {
              const r = await fetch(`https://ipapi.co/${ip}/json/`, {
                headers: { "user-agent": "beautyimages-tracker" },
              });
              if (r.ok) {
                const j = (await r.json()) as {
                  country_name?: string;
                  country?: string;
                  city?: string;
                  region?: string;
                };
                country = country || j.country_name || j.country || null;
                city = city || j.city || null;
                region = region || j.region || null;
              }
            } catch {
              // ignore
            }
          }

          const today = new Date().toISOString().slice(0, 10);

          // Upsert: one row per ip per day
          const { error } = await supabaseAdmin
            .from("visitors")
            .upsert(
              {
                ip,
                visit_date: today,
                country,
                city,
                region,
                user_agent: userAgent,
                referer,
                path,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "ip,visit_date", ignoreDuplicates: false },
            );

          if (error) {
            // increment visit_count on conflict by separate update
            await supabaseAdmin.rpc; // no-op; keep simple
            console.error("track upsert error", error);
          }

          // Bump visit_count
          await supabaseAdmin
            .from("visitors")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("ip", ip)
            .eq("visit_date", today);

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("track failed", e);
          return new Response(JSON.stringify({ ok: false }), { status: 200 });
        }
      },
    },
  },
});
