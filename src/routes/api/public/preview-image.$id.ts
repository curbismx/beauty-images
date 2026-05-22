import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Simple, reliable passthrough: look up the image, fetch its stored preview
// from storage, and serve the bytes. No image processing happens here — the
// watermark is drawn as an overlay on the page — so there is nothing that can
// crash. This is what fixes the broken (default-icon) thumbnails.
export const Route = createFileRoute("/api/public/preview-image/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Invalid id", { status: 400 });
        }

        const supabase = getSupabase();

        const { data: row, error } = await supabase
          .from("images")
          .select("preview_path, public")
          .eq("id", id)
          .maybeSingle();
        if (error || !row || !row.public || !row.preview_path) {
          return new Response("Not found", { status: 404 });
        }

        const { data: original, error: dlErr } = await supabase.storage
          .from("images-private")
          .download(row.preview_path);
        if (dlErr || !original) {
          return new Response("Source missing", { status: 404 });
        }

        const bytes = new Uint8Array(await original.arrayBuffer());
        return new Response(bytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(bytes.byteLength),
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
