import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PhotonImage, resize, SamplingFilter } from "@cf-wasm/photon";

const MAX_ATTEMPTS = 3;
const PREVIEW_BATCH = 25;
const KEYWORD_BATCH = 25;
const PREVIEW_EDGE = 800;

const KEYWORD_PROMPT = `You are a professional stock-photo keyworder. Analyze the image and return strict JSON with this exact shape:
{
  "title": "short descriptive headline, max 12 words, no trailing period",
  "description": "1-2 sentence natural caption suitable as alt text",
  "keywords": ["20 to 30 single or short multi-word stock keywords, lowercase, no duplicates"],
  "category": "one of: Nature, Portrait, Lifestyle, Architecture, Travel, Food, Business, Fashion, Abstract, Sport, Animal, Other"
}
Return ONLY the JSON object, no markdown, no commentary.`;

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function bytesToBase64(buf: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.byteLength; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(buf.subarray(i, Math.min(i + chunk, buf.byteLength))),
    );
  }
  return btoa(bin);
}

async function resizeTo800Jpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const img = PhotonImage.new_from_byteslice(bytes);
  const w = img.get_width();
  const h = img.get_height();
  const longest = Math.max(w, h);
  let out = img;
  if (longest > PREVIEW_EDGE) {
    const scale = PREVIEW_EDGE / longest;
    out = resize(img, Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), SamplingFilter.Lanczos3);
    img.free();
  }
  const bytesOut = out.get_bytes_jpeg(82);
  out.free();
  return bytesOut;
}

async function keywordOne(dataUrl: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: KEYWORD_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty AI response");
  const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    title: String(parsed.title ?? "").slice(0, 240),
    description: String(parsed.description ?? "").slice(0, 1000),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: unknown) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 40)
      : [],
    category: String(parsed.category ?? "Other").slice(0, 50),
  };
}

async function markFailure(
  supabase: ReturnType<typeof admin>,
  id: string,
  attempts: number,
  err: unknown,
) {
  const nextAttempts = attempts + 1;
  const message = (err as Error).message ?? String(err);
  await supabase
    .from("images")
    .update({
      processing_attempts: nextAttempts,
      processing_error: message.slice(0, 1000),
    })
    .eq("id", id);
}

// Stale claims older than this are reclaimable (handles crashed runs).
const CLAIM_TTL_MS = 5 * 60 * 1000;

async function claimRows(
  supabase: ReturnType<typeof admin>,
  ids: string[],
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const staleCutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const nowIso = new Date().toISOString();
  // Atomic claim: only rows still unclaimed (or with a stale claim) flip to nowIso.
  const { data, error } = await supabase
    .from("images")
    .update({ processing_started_at: nowIso })
    .in("id", ids)
    .or(`processing_started_at.is.null,processing_started_at.lt.${staleCutoff}`)
    .select("id");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.id as string));
}

async function releaseRow(supabase: ReturnType<typeof admin>, id: string) {
  await supabase.from("images").update({ processing_started_at: null }).eq("id", id);
}

async function processPreviews(supabase: ReturnType<typeof admin>) {
  const staleCutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const { data: candidates, error } = await supabase
    .from("images")
    .select("id, storage_path, processing_attempts")
    .is("preview_path", null)
    .lt("processing_attempts", MAX_ATTEMPTS)
    .or(`processing_started_at.is.null,processing_started_at.lt.${staleCutoff}`)
    .order("image_number", { ascending: true })
    .limit(PREVIEW_BATCH);
  if (error) throw new Error(error.message);
  if (!candidates?.length) return { processed: 0, failed: 0 };

  const claimed = await claimRows(supabase, candidates.map((r) => r.id));
  const rows = candidates.filter((r) => claimed.has(r.id));
  if (!rows.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (row) => {
      try {
        const dl = await supabase.storage.from("images-private").download(row.storage_path);
        if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download failed");
        const inBytes = new Uint8Array(await dl.data.arrayBuffer());
        const outBytes = await resizeTo800Jpeg(inBytes);
        const previewPath = `previews/${row.id}.jpg`;
        const up = await supabase.storage
          .from("images-private")
          .upload(previewPath, outBytes, { contentType: "image/jpeg", upsert: true });
        if (up.error) throw new Error(up.error.message);
        const { error: upErr } = await supabase
          .from("images")
          .update({
            preview_path: previewPath,
            processing_attempts: 0,
            processing_error: null,
            processing_started_at: null,
          })
          .eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        processed += 1;
      } catch (e) {
        failed += 1;
        await markFailure(supabase, row.id, row.processing_attempts ?? 0, e);
        await releaseRow(supabase, row.id);
        console.error("preview failed", row.id, e);
      }
    }),
  );
  return { processed, failed };
}

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function processKeywords(supabase: ReturnType<typeof admin>) {
  const staleCutoff = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const { data: candidates, error } = await supabase
    .from("images")
    .select("id, image_number, filename, preview_path, processing_attempts")
    .is("keyworded_at", null)
    .not("preview_path", "is", null)
    .lt("processing_attempts", MAX_ATTEMPTS)
    .or(`processing_started_at.is.null,processing_started_at.lt.${staleCutoff}`)
    .order("image_number", { ascending: true })
    .limit(KEYWORD_BATCH);
  if (error) throw new Error(error.message);
  if (!candidates?.length) return { processed: 0, failed: 0 };

  const claimed = await claimRows(supabase, candidates.map((r) => r.id));
  const rows = candidates.filter((r) => claimed.has(r.id));
  if (!rows.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (row) => {
      try {
        const dl = await supabase.storage.from("images-private").download(row.preview_path as string);
        if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "preview download failed");
        const buf = new Uint8Array(await dl.data.arrayBuffer());
        const dataUrl = `data:${guessMime(row.filename)};base64,${bytesToBase64(buf)}`;
        const r = await keywordOne(dataUrl);
        const { error: upErr } = await supabase
          .from("images")
          .update({
            title: r.title,
            caption: r.description,
            keywords: r.keywords,
            category: r.category,
            keyworded_at: new Date().toISOString(),
            processing_attempts: 0,
            processing_error: null,
            processing_started_at: null,
          })
          .eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        processed += 1;
      } catch (e) {
        failed += 1;
        await markFailure(supabase, row.id, row.processing_attempts ?? 0, e);
        await releaseRow(supabase, row.id);
        console.error("keyword failed", row.id, e);
      }
    }),
  );
  return { processed, failed };
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const Route = createFileRoute("/api/public/hooks/process-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return Response.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
        }
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!timingSafeEqualStr(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const supabase = admin();
        try {
          const previews = await processPreviews(supabase);
          const keywords = await processKeywords(supabase);
          return Response.json({ ok: true, previews, keywords });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});

