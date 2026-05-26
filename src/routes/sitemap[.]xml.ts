import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_URL, COLLECTIONS } from "@/lib/seo";

// A sitemap file may contain at most 50,000 URLs.
const MAX_URLS = 50000;
const DB_PAGE_SIZE = 1000;

// Static public routes to advertise (in addition to per-image pages).
const STATIC_PATHS = [
  "/",
  "/about",
  "/licensing",
  "/real-photography-no-ai",
  "/collections",
  "/contact",
  "/licence",
  "/privacy",
  ...COLLECTIONS.map((c) => `/collections/${c.slug}`),
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const origin = SITE_URL;
        const urls: string[] = STATIC_PATHS.map((p) => `${origin}${p}`);

        try {
          // Supabase returns at most 1000 rows per query, so page through
          // every public image that has a preview.
          for (let from = 0; urls.length < MAX_URLS; from += DB_PAGE_SIZE) {
            const { data: rows, error } = await supabaseAdmin
              .from("images")
              .select("id")
              .eq("public", true)
              .not("preview_path", "is", null)
              .order("image_number", { ascending: false })
              .range(from, from + DB_PAGE_SIZE - 1);
            if (error) throw new Error(error.message);

            const pageRows = rows ?? [];
            for (const r of pageRows) {
              if (urls.length >= MAX_URLS) break;
              urls.push(`${origin}/image/${r.id}`);
            }
            if (pageRows.length < DB_PAGE_SIZE) break;
          }
        } catch (e) {
          console.error("sitemap generation failed", e);
          // Still return a valid sitemap (at least the homepage).
        }

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`).join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
