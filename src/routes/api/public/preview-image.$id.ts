import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { getWatermarkBytes } from "@/lib/watermark-data.server";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CACHE_BUCKET = "images-derived";
// Cache key bumped to v5 so any stale / un-watermarked previews cached by the
// previous (broken) build are regenerated on first request.
const CACHE_KEY = (id: string) => `${id}/preview-wm-v5.jpg`;

// Composite the BEAUTYIMAGES watermark onto a JPEG.
//
// All decoding/encoding runs through @cf-wasm/photon (WebAssembly) — the same
// library used by resize-jpeg.server.ts — because it is the only image stack
// that runs reliably inside the Cloudflare Workers runtime. The previous
// implementation used pngjs, whose synchronous PNG decoder reaches into Node
// zlib internals that the Workers runtime does not provide, so the composite
// threw on every request and the route returned HTTP 500 (broken-image icon).
// The pixel blend below is plain JavaScript and runs anywhere.
async function compositeWatermark(jpegBytes: Uint8Array): Promise<Uint8Array> {
  const photon = await import("@cf-wasm/photon/workerd");

  // Decode the base photo -> raw RGBA pixels.
  const baseImg = photon.PhotonImage.new_from_byteslice(jpegBytes);
  const baseW = baseImg.get_width();
  const baseH = baseImg.get_height();
  const baseData = baseImg.get_raw_pixels();
  baseImg.free();

  // Decode the watermark PNG -> raw RGBA pixels (alpha channel preserved).
  const wmImg = photon.PhotonImage.new_from_byteslice(getWatermarkBytes());
  const wmW = wmImg.get_width();
  const wmH = wmImg.get_height();
  const wmData = wmImg.get_raw_pixels();
  wmImg.free();

  // The watermark's left edge always begins halfway across the image. It is
  // scaled to fill that right half and centred vertically; anything that would
  // extend past the right edge is naturally clipped.
  const x = Math.floor(baseW / 2);
  const drawW = Math.max(0, baseW - x);
  const scaledH = Math.max(1, Math.round(drawW * (wmH / wmW)));
  const y = Math.max(0, Math.floor((baseH - scaledH) / 2));
  const drawH = Math.min(scaledH, Math.max(0, baseH - y));

  for (let wy = 0; wy < drawH; wy++) {
    const sourceY = Math.min(wmH - 1, Math.floor((wy / scaledH) * wmH));
    for (let wx = 0; wx < drawW; wx++) {
      const sourceX = Math.min(wmW - 1, Math.floor((wx / drawW) * wmW));
      const source = (sourceY * wmW + sourceX) * 4;
      const alpha = wmData[source + 3] / 255;
      if (alpha <= 0) continue;

      const target = ((y + wy) * baseW + x + wx) * 4;
      const inverseAlpha = 1 - alpha;
      baseData[target] = Math.round(wmData[source] * alpha + baseData[target] * inverseAlpha);
      baseData[target + 1] = Math.round(wmData[source + 1] * alpha + baseData[target + 1] * inverseAlpha);
      baseData[target + 2] = Math.round(wmData[source + 2] * alpha + baseData[target + 2] * inverseAlpha);
      baseData[target + 3] = 255;
    }
  }

  // Re-encode the watermarked pixels as JPEG.
  const outImg = new photon.PhotonImage(baseData, baseW, baseH);
  const outBytes = outImg.get_bytes_jpeg(86);
  outImg.free();
  return outBytes;
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
            outBytes = await compositeWatermark(sourceBytes);
          } catch (e) {
            console.error("Watermark composite failed:", e);
            return new Response("Watermark failed", { status: 500 });
          }
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
