import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// The grid/basket request w=500; any other value (or none) serves the full
// stored preview.
const ALLOWED_WIDTHS = new Set([500]);
const DERIVED_BUCKET = "images-derived";

// A preview for a given id never changes, so it can be cached hard.
const IMG_HEADERS = {
  "Content-Type": "image/jpeg",
  "Cache-Control": "public, max-age=31536000, immutable",
};

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export const Route = createFileRoute("/api/public/preview-image/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Invalid id", { status: 400 });
        }

        const widthParam = Number(new URL(request.url).searchParams.get("w"));
        const wantsThumb = ALLOWED_WIDTHS.has(widthParam);

        const supabase = getSupabase();

        const { data: row, error } = await supabase
          .from("images")
          .select("preview_path, public")
          .eq("id", id)
          .maybeSingle();
        if (error || !row || !row.public || !row.preview_path) {
          return new Response("Not found", { status: 404 });
        }

        const serve = (bytes: Uint8Array) =>
          new Response(bytes as BodyInit, { status: 200, headers: IMG_HEADERS });

        const downloadPreview = async (): Promise<Uint8Array | null> => {
          const { data: file } = await supabase.storage
            .from("images-private")
            .download(row.preview_path as string);
          if (!file) return null;
          return new Uint8Array(await file.arrayBuffer());
        };

        // Thumbnail request (grid / basket): serve the pre-generated thumbnail.
        if (wantsThumb) {
          const { data: thumb } = await supabase.storage
            .from(DERIVED_BUCKET)
            .download(`thumb/${id}.jpg`);
          if (thumb) {
            return serve(new Uint8Array(await thumb.arrayBuffer()));
          }
          // No thumbnail yet (e.g. an image added after the last batch run) —
          // fall back to the full preview so it still loads.
          console.warn(`No thumbnail for ${id}; serving full preview`);
        }

        // Full-size request (single-image page), or thumbnail fallback:
        // passthrough the stored preview.
        const bytes = await downloadPreview();
        if (!bytes) {
          return new Response("Source missing", { status: 404 });
        }
        return serve(bytes);
      },
    },
  },
});
