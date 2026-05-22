import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getWatermarkBytes, WATERMARK_W, WATERMARK_H } from "@/lib/watermark-data.server";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CACHE_BUCKET = "images-derived";
const CACHE_KEY = (id: string) => `${id}/preview-wm-v2.jpg`;

async function compositeWatermark(jpegBytes: Uint8Array): Promise<Uint8Array> {
  const photon = await import("@/lib/photon-init.server");
  const img = photon.PhotonImage.new_from_byteslice(jpegBytes);
  const iw = img.get_width();
  const ih = img.get_height();

  // Decode watermark.
  const wmFull = photon.PhotonImage.new_from_byteslice(getWatermarkBytes());

  // Left edge of watermark sits at exactly 50% of image width.
  // Watermark draws at native size; if it overflows the right edge, crop the overflow.
  const x = Math.floor(iw / 2);
  const avail = iw - x;
  const wmW = WATERMARK_W;
  const wmH = WATERMARK_H;

  let wmToDraw = wmFull;
  let cropped: any = null;
  if (avail < wmW) {
    cropped = photon.crop(wmFull, 0, 0, avail, wmH);
    wmToDraw = cropped;
  }

  // Vertically centered ("halfway down").
  const y = Math.max(0, Math.floor((ih - wmH) / 2));

  photon.watermark(img, wmToDraw, BigInt(x), BigInt(y));

  const out = img.get_bytes_jpeg(85);

  img.free();
  wmFull.free();
  if (cropped) cropped.free();
  return out;
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
            outBytes = await compositeWatermark(sourceBytes);
          } catch (e) {
            console.error("Watermark composite failed:", e);
            outBytes = sourceBytes;
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
