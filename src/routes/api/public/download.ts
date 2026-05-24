import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Longest-edge cap per tier. 0 = full resolution (the original, no resize).
const TIER_MAX_EDGE: Record<string, number> = { small: 800, medium: 2000, large: 0 };
// Full tier word used in the download filename.
const TIER_LABEL: Record<string, string> = { small: "SMALL", medium: "MEDIUM", large: "LARGE" };

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

        // Verify the buyer is entitled to this image.
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

        // e.g. 00010001_LARGE.jpg
        const filename = `${String(image.image_number).padStart(8, "0")}_${TIER_LABEL[tier] ?? "MEDIUM"}.jpg`;

        const serve = (bytes: Uint8Array) =>
          new Response(bytes as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "image/jpeg",
              "Content-Length": String(bytes.byteLength),
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "private, max-age=0, no-store",
            },
          });

        // Bump the download counter (best-effort, fire-and-forget).
        const bumpCount = () =>
          supabase
            .from("sales")
            .update({
              download_count: ((sale as any).download_count ?? 0) + 1,
              last_downloaded_at: new Date().toISOString(),
            })
            .eq("id", sale.id)
            .then(() => {});

        const downloadOriginal = async () => {
          const { data: original, error: dlErr } = await supabase.storage
            .from("images-private")
            .download(image.storage_path);
          if (dlErr || !original) return null;
          return new Uint8Array(await original.arrayBuffer());
        };

        // LARGE tier = the untouched original. No resize needed.
        if (maxEdge <= 0) {
          const bytes = await downloadOriginal();
          if (!bytes) return new Response("Source missing", { status: 404 });
          bumpCount();
          return serve(bytes);
        }

        // SMALL / MEDIUM: serve a cached derivative if one already exists.
        const cachePath = `${imageId}/${tier}.jpg`;
        const { data: cached } = await supabase.storage
          .from("images-derived")
          .download(cachePath);
        if (cached) {
          bumpCount();
          return serve(new Uint8Array(await cached.arrayBuffer()));
        }

        // No cached derivative yet. Resize the original at Cloudflare's edge
        // via the cf.image fetch option, so the heavy image decoding never
        // runs inside this Worker's limited memory (the previous in-Worker
        // resize exhausted memory on large originals and failed).
        let outBytes: Uint8Array | null = null;
        const { data: signed } = await supabase.storage
          .from("images-private")
          .createSignedUrl(image.storage_path, 120);

        if (signed?.signedUrl) {
          try {
            const resized = await fetch(signed.signedUrl, {
              cf: {
                image: {
                  width: maxEdge,
                  height: maxEdge,
                  fit: "scale-down",
                  format: "jpeg",
                  quality: 90,
                },
              },
            } as any);
            if (resized.ok) {
              outBytes = new Uint8Array(await resized.arrayBuffer());
            } else {
              console.error(`Edge resize HTTP ${resized.status} for ${imageId} (${tier})`);
            }
          } catch (e) {
            console.error(`Edge resize failed for ${imageId} (${tier}):`, e);
          }
        }

        if (outBytes) {
          // Cache the derivative so every later download of this tier is instant.
          await supabase.storage
            .from("images-derived")
            .upload(cachePath, outBytes, { contentType: "image/jpeg", upsert: true })
            .catch((e) => console.error("Cache upload failed:", e));
          bumpCount();
          return serve(outBytes);
        }

        // Edge resize unavailable — fall back to the full-resolution original
        // so the buyer always gets a usable file. Not cached, so a later
        // request can still produce the correct smaller tier.
        console.warn(`Serving full original as fallback for ${imageId} (${tier})`);
        const fallback = await downloadOriginal();
        if (!fallback) return new Response("Source missing", { status: 404 });
        bumpCount();
        return serve(fallback);
      },
    },
  },
});
