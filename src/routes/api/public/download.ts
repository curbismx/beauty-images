import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { resizeJpeg } from "@/lib/resize-jpeg.server";

const TIER_MAX_EDGE: Record<string, number> = {
  small: 800,
  medium: 2000,
  large: 0,
};
const TIER_CODE: Record<string, string> = { small: "S", medium: "M", large: "L" };

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export const Route = createFileRoute("/api/public/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id") || "";
        const imageId = url.searchParams.get("image_id") || "";

        if (!/^cs_[a-zA-Z0-9_]{20,}$/.test(sessionId)) {
          return new Response("Invalid session", { status: 400 });
        }
        if (!/^[0-9a-f-]{36}$/i.test(imageId)) {
          return new Response("Invalid image", { status: 400 });
        }

        const supabase = getSupabase();

        // Verify entitlement.
        const { data: sale, error: saleErr } = await supabase
          .from("sales")
          .select("id, image_id, download_tier")
          .eq("stripe_session_id", sessionId)
          .eq("image_id", imageId)
          .limit(1)
          .maybeSingle();

        if (saleErr || !sale) {
          return new Response("Not found", { status: 404 });
        }

        const tier = (sale.download_tier as string) || "medium";
        const maxEdge = TIER_MAX_EDGE[tier] ?? 2000;

        const { data: image, error: imgErr } = await supabase
          .from("images")
          .select("storage_path, image_number")
          .eq("id", imageId)
          .single();

        if (imgErr || !image?.storage_path) {
          return new Response("Image missing", { status: 404 });
        }

        const filename = `BEAUTYIMAGES_${String(image.image_number).padStart(8, "0")}_${TIER_CODE[tier] ?? "M"}.jpg`;
        const cachePath = `${imageId}/${tier}.jpg`;

        // Try cache first.
        const { data: cached } = await supabase.storage
          .from("images-derived")
          .download(cachePath);

        let outBytes: Uint8Array;
        if (cached) {
          outBytes = new Uint8Array(await cached.arrayBuffer());
        } else {
          const { data: original, error: dlErr } = await supabase.storage
            .from("images-private")
            .download(image.storage_path);
          if (dlErr || !original) {
            return new Response("Source missing", { status: 404 });
          }
          const sourceBytes = new Uint8Array(await original.arrayBuffer());
          let resizedOk = true;
          try {
            outBytes = await resizeJpeg(sourceBytes, maxEdge);
          } catch (e) {
            // Resize failed — fall back to the full-resolution original so the
            // buyer always gets a usable file. Do NOT cache this under the tier
            // path (that would poison future requests for the smaller tier).
            console.error(`Resize failed for image ${imageId} tier ${tier}, serving original:`, e);
            outBytes = sourceBytes;
            resizedOk = false;
          }
          if (resizedOk) {
            await supabase.storage
              .from("images-derived")
              .upload(cachePath, outBytes, {
                contentType: "image/jpeg",
                upsert: true,
              })
              .catch((e) => console.error("Cache upload failed:", e));
          }
        }

        // Bump download counter (best-effort, fire-and-forget).
        supabase
          .from("sales")
          .update({
            download_count: ((sale as any).download_count ?? 0) + 1,
            last_downloaded_at: new Date().toISOString(),
          })
          .eq("id", sale.id)
          .then(() => {});

        return new Response(outBytes as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(outBytes.byteLength),
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, max-age=0, no-store",
          },
        });
      },
    },
  },
});
