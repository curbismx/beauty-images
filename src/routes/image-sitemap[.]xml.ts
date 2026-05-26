import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Google Image Sitemap. Lets Google index every image page along with its
// title, caption and licence — directly feeds the "Licensable" badge in
// Google Images alongside the JSON-LD on the image page.
const SITE_URL = "https://beautyimages.com";
const LICENCE_URL = `${SITE_URL}/licence`;
const MAX_URLS = 50000;
const DB_PAGE_SIZE = 1000;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/image-sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Array<{ id: string; title: string | null; caption: string | null }> = [];
        try {
          for (let from = 0; entries.length < MAX_URLS; from += DB_PAGE_SIZE) {
            const { data: rows, error } = await supabaseAdmin
              .from("images")
              .select("id, title, caption")
              .eq("public", true)
              .not("preview_path", "is", null)
              .order("image_number", { ascending: false })
              .range(from, from + DB_PAGE_SIZE - 1);
            if (error) throw new Error(error.message);
            const pageRows = rows ?? [];
            for (const r of pageRows) {
              if (entries.length >= MAX_URLS) break;
              entries.push({ id: r.id as string, title: r.title as string | null, caption: r.caption as string | null });
            }
            if (pageRows.length < DB_PAGE_SIZE) break;
          }
        } catch (e) {
          console.error("image sitemap generation failed", e);
        }

        const urlBlocks = entries.map((e) => {
          const page = `${SITE_URL}/image/${e.id}`;
          const loc = `${SITE_URL}/api/public/preview-image/${e.id}`;
          const parts = [
            `  <url>`,
            `    <loc>${page}</loc>`,
            `    <image:image>`,
            `      <image:loc>${loc}</image:loc>`,
            e.title ? `      <image:title>${xmlEscape(e.title)}</image:title>` : null,
            e.caption ? `      <image:caption>${xmlEscape(e.caption)}</image:caption>` : null,
            `      <image:license>${LICENCE_URL}</image:license>`,
            `    </image:image>`,
            `  </url>`,
          ].filter(Boolean);
          return parts.join("\n");
        });

        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
          urlBlocks.join("\n") +
          `\n</urlset>\n`;

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
