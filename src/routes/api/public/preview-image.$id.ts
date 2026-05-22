import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { decode as decodeJpeg, encode as encodeJpeg } from "jpeg-js";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CACHE_BUCKET = "images-derived";
// Cache key bumped so previews from earlier builds are regenerated.
const CACHE_KEY = (id: string) => `${id}/preview-wm-v7.jpg`;

type Variant = "portrait" | "square" | "landscape";

// The three watermark images live in the public/ folder, so they can be
// swapped just by re-uploading the files — no code change needed.
const WM_FILE: Record<Variant, string> = {
  portrait: "/watermark_portrait.png",
  square: "/watermark_square.png",
  landscape: "/watermark_landscape.png",
};

type DecodedWm = { data: Uint8Array; width: number; height: number };
const wmCache: Partial<Record<Variant, DecodedWm>> = {};

async function getWatermark(variant: Variant, origin: string): Promise<DecodedWm> {
  const cached = wmCache[variant];
  if (cached) return cached;
  const res = await fetch(new URL(WM_FILE[variant], origin));
  if (!res.ok) {
    throw new Error(`Watermark not found: ${WM_FILE[variant]} (HTTP ${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const decoded = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  const wm: DecodedWm = {
    data: decoded.data as Uint8Array,
    width: decoded.width,
    height: decoded.height,
  };
  wmCache[variant] = wm;
  return wm;
}

// Aspect ratio < 0.9 -> portrait watermark, 0.9-1.1 -> square, > 1.1 -> landscape.
function pickVariant(width: number, height: number): Variant {
  const aspect = width / height;
  if (aspect < 0.9) return "portrait";
  if (aspect > 1.1) return "landscape";
  return "square";
}

// Bake the watermark into the JPEG. The chosen watermark is drawn at its
// native size, left edge at 50% of the photo width, vertically centred at 60%
// of the height. Anything past the right edge is clipped. Because it is
// composited into the pixels, the watermark travels with the file if saved.
async function compositeWatermark(jpegBytes: Uint8Array, origin: string): Promise<Uint8Array> {
  const photo = decodeJpeg(jpegBytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxMemoryUsageInMB: 512,
  });
  const pw = photo.width;
  const ph = photo.height;

  const wm = await getWatermark(pickVariant(pw, ph), origin);
  const ww = wm.width;
  const wh = wm.height;

  const x = Math.floor(pw / 2);
  let y = Math.round(0.6 * ph - wh / 2);
  y = wh <= ph ? Math.max(0, Math.min(y, ph - wh)) : 0;

  const photoData = photo.data as Uint8Array;
  for (let row = 0; row < wh; row++) {
    const py = y + row;
    if (py < 0 || py >= ph) continue;
    for (let col = 0; col < ww; col++) {
      const px = x + col;
      if (px < 0 || px >= pw) continue; // clip overflow past the right edge
      const s = (row * ww + col) * 4;
      const t = (py * pw + px) * 4;
      photoData[t] = wm.data[s];
      photoData[t + 1] = wm.data[s + 1];
      photoData[t + 2] = wm.data[s + 2];
      photoData[t + 3] = 255;
    }
  }

  return new Uint8Array(encodeJpeg({ data: photoData, width: pw, height: ph }, 86).data);
}

export const Route = createFileRoute("/api/public/preview-image/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return new Response("Invalid id", { status: 400 });
        }

        const origin = new URL(request.url).origin;
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
            outBytes = await compositeWatermark(sourceBytes, origin);
          } catch (e) {
            console.error("Watermark composite failed:", e);
            return new Response("Watermark failed", { status: 500 });
          }
          await supabase.storage
            .from(CACHE_BUCKET)
            .upload(cachePath, outBytes, { contentType: "image/jpeg", upsert: true })
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
