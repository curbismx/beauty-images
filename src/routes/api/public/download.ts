import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Full tier word used in the download filename.
const TIER_LABEL: Record<string, string> = { small: "SMALL", medium: "MEDIUM", large: "LARGE" };
// Pre-generated derivative folder per tier. "large" has no derivative — it is
// served as the untouched original.
const TIER_FOLDER: Record<string, string> = { small: "small", medium: "medium" };

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
          .select("id, image_id, download_tier, download_count")
          .eq("stripe_session_id", sessionId)
          .eq("image_id", imageId)
          .limit(1)
          .maybeSingle();

        if (saleErr || !sale) {
          return new Response("Not found", { status: 404 });
        }

        const tier = (sale.download_tier as string) || "medium";

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

        const downloadOriginal = async (): Promise<Uint8Array | null> => {
          const { data: original } = await supabase.storage
            .from("images-private")
            .download(image.storage_path);
          if (!original) return null;
          return new Uint8Array(await original.arrayBuffer());
        };

        // LARGE tier = the untouched original.
        const folder = TIER_FOLDER[tier];
        if (!folder) {
          const bytes = await downloadOriginal();
          if (!bytes) return new Response("Source missing", { status: 404 });
          bumpCount();
          return serve(bytes);
        }

        // SMALL / MEDIUM tier = the pre-generated derivative.
        const { data: derivative } = await supabase.storage
          .from("images-derived")
          .download(`${folder}/${imageId}.jpg`);
        if (derivative) {
          bumpCount();
          return serve(new Uint8Array(await derivative.arrayBuffer()));
        }

        // Derivative missing (e.g. an image added after the last batch run) —
        // fall back to the original so the buyer always gets a usable file.
        console.warn(`No ${tier} derivative for ${imageId}; serving original`);
        const original = await downloadOriginal();
        if (!original) return new Response("Source missing", { status: 404 });
        bumpCount();
        return serve(original);
      },
    },
  },
});
