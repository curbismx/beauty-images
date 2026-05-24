import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resizeJpeg } from "@/lib/resize-jpeg.server";

// Allowed thumbnail widths. The grid requests w=500; any other value (or no
// param) serves the full stored preview. An allowlist means arbitrary ?w
// values can't fill the cache bucket with junk sizes.
const ALLOWED_WIDTHS = new Set([500]);
const CACHE_BUCKET = "images-derived";

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
        const width = ALLOWED_WIDTHS.has(widthParam) ? widthParam : 0; // 0 = full

        const supabase = getSupabase();

        const { data: row, error } = await supabase
          .from("images")
          .select("preview_path, public")
          .eq("id", id)
          .maybeSingle();
        if (error || !row || !row.public || !row.preview_path) {
          return new Response("Not found", { status: 404 });
        }

        // Full-size request (single-image page): passthrough the stored
        // preview. No processing — nothing here can crash.
        if (width === 0) {
          const { data: original, error: dlErr } = await supabase.storage
            .from("images-private")
            .download(row.preview_path);
          if (dlErr || !original) {
            return new Response("Source missing", { status: 404 });
          }
          const bytes = new Uint8Array(await original.arrayBuffer());
          return new Response(bytes as BodyInit, { status: 200, headers: IMG_HEADERS });
        }

        // Thumbnail request: serve a resized copy. Resize ONCE, store it, then
        // every later request is a fast cache hit on a small file.
        const cachePath = `thumb/${id}/${width}.jpg`;

        const { data: cached } = await supabase.storage
          .from(CACHE_BUCKET)
          .download(cachePath);
        if (cached) {
          const bytes = new Uint8Array(await cached.arrayBuffer());
          return new Response(bytes as BodyInit, { status: 200, headers: IMG_HEADERS });
        }

        const { data: original, error: dlErr } = await supabase.storage
          .from("images-private")
          .download(row.preview_path);
        if (dlErr || !original) {
          return new Response("Source missing", { status: 404 });
        }
        const sourceBytes = new Uint8Array(await original.arrayBuffer());

        // The in-Worker JPEG decode allocates the whole image as raw pixels in
        // memory. A normal ~800px preview is well under 1 MB; a much larger
        // source can exhaust the Worker's memory mid-decode, which kills the
        // request outright (it cannot be caught) and the thumbnail fails to
        // load. If the source is that large, skip the resize and serve it
        // as-is so the thumbnail still loads.

        const MAX_RESIZE_INPUT_BYTES = 2_000_000;

        let outBytes: Uint8Array;
        let resizedOk = true;

        if (sourceBytes.byteLength > MAX_RESIZE_INPUT_BYTES) {
          console.warn(
            `Preview source too large to resize safely (${sourceBytes.byteLength} bytes) for ${id}; serving as-is`,
          );
          outBytes = sourceBytes;
          resizedOk = false;
        } else {
          try {
            outBytes = await resizeJpeg(sourceBytes, width);
          } catch (e) {
            // Don't cache failures — caching the full original poisons the
            // bucket and every later request serves a multi-MB "thumbnail".
            console.error("Thumbnail resize failed:", e);
            resizedOk = false;
            outBytes = sourceBytes;
          }
        }

        if (resizedOk) {
          // Cache for next time (best-effort — a failure here is harmless).
          await supabase.storage
            .from(CACHE_BUCKET)
            .upload(cachePath, outBytes, { contentType: "image/jpeg", upsert: true })
            .catch((e) => console.error("Thumbnail cache upload failed:", e));
        }

        return new Response(outBytes as BodyInit, { status: 200, headers: IMG_HEADERS });
      },
    },
  },
});
