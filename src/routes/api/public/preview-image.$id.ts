import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

import { getWatermarkBytes, WATERMARK_W, WATERMARK_H } from "@/lib/watermark-data.server";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CACHE_BUCKET = "images-derived";
const CACHE_KEY = (id: string) => `${id}/preview-wm-v4.jpg`;

function compositeWatermark(jpegBytes: Uint8Array): Uint8Array {
  const base = decodeJpeg(jpegBytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: 768,
  });
  const watermark = PNG.sync.read(Buffer.from(getWatermarkBytes()));

  // The watermark's left edge must always begin halfway across the image.
  // Anything that would extend beyond the right side is naturally clipped.
  const x = Math.floor(base.width / 2);
  const drawW = Math.max(0, base.width - x);
  const scaledH = Math.max(1, Math.round(drawW * (WATERMARK_H / WATERMARK_W)));
  const y = Math.max(0, Math.floor((base.height - scaledH) / 2));
  const drawH = Math.min(scaledH, Math.max(0, base.height - y));

  for (let wy = 0; wy < drawH; wy++) {
    const sourceY = Math.min(watermark.height - 1, Math.floor((wy / scaledH) * watermark.height));
    for (let wx = 0; wx < drawW; wx++) {
      const sourceX = Math.min(watermark.width - 1, Math.floor((wx / drawW) * watermark.width));
      const source = (sourceY * watermark.width + sourceX) * 4;
      const alpha = watermark.data[source + 3] / 255;
      if (alpha <= 0) continue;

      const target = ((y + wy) * base.width + x + wx) * 4;
      const inverseAlpha = 1 - alpha;
      base.data[target] = Math.round(watermark.data[source] * alpha + base.data[target] * inverseAlpha);
      base.data[target + 1] = Math.round(watermark.data[source + 1] * alpha + base.data[target + 1] * inverseAlpha);
      base.data[target + 2] = Math.round(watermark.data[source + 2] * alpha + base.data[target + 2] * inverseAlpha);
      base.data[target + 3] = 255;
    }
  }

  return new Uint8Array(encodeJpeg({ data: base.data, width: base.width, height: base.height }, 86).data);
}

export const Route = createFileRoute("/api/public/preview-image/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Invalid id", { status: 400 });
        }

        const supabase = getSupabase();

        // Verify image is public and get preview path.
        const { data: row, error } = await supabase
          .from("images")
          .select("preview_path, public")
          .eq("id", id)
          .maybeSingle();
        if (error || !row || !row.public || !row.preview_path) {
          return new Response("Not found", { status: 404 });
        }

        const cachePath = CACHE_KEY(id);
        let outBytes: Uint8Array | null = null;

        // Try cache.
        const { data: cached } = await supabase.storage
          .from(CACHE_BUCKET)
          .download(cachePath);
        if (cached) {
          outBytes = new Uint8Array(await cached.arrayBuffer());
        } else {
          const { data: original, error: dlErr } = await supabase.storage
            .from("images-private")
            .download(row.preview_path);
          if (dlErr || !original) {
            return new Response("Source missing", { status: 404 });
          }
          const sourceBytes = new Uint8Array(await original.arrayBuffer());
          try {
            outBytes = compositeWatermark(sourceBytes);
          } catch (e) {
            console.error("Watermark composite failed:", e);
            return new Response("Watermark failed", { status: 500 });
          }
          // Best-effort cache.
          await supabase.storage
            .from(CACHE_BUCKET)
            .upload(cachePath, outBytes, {
              contentType: "image/jpeg",
              upsert: true,
            })
            .catch((e) => console.error("Cache upload failed:", e));
        }

        return new Response(outBytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(outBytes.byteLength),
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
