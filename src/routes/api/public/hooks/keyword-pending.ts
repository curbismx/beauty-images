import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const KEYWORD_PROMPT = `You are a professional stock-photo keyworder. Analyze the image and return strict JSON with this exact shape:
{
  "title": "short descriptive headline, max 12 words, no trailing period",
  "description": "1-2 sentence natural caption suitable as alt text",
  "keywords": ["20 to 30 single or short multi-word stock keywords, lowercase, no duplicates"],
  "category": "one of: Nature, Portrait, Lifestyle, Architecture, Travel, Food, Business, Fashion, Abstract, Sport, Animal, Other"
}
Return ONLY the JSON object, no markdown, no commentary.`;

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
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

export const Route = createFileRoute("/api/public/hooks/keyword-pending")({
  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        // Process up to 5 images per invocation. Combined with a 5-minute cron
        // schedule that yields ~1,440 keywords / 24h, just under the 1,500/day cap.
        const BATCH = 5;
        const { data: rows, error } = await supabase
          .from("images")
          .select("id, image_number, filename, storage_path")
          .is("keyworded_at", null)
          .order("image_number", { ascending: true })
          .limit(BATCH);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        if (!rows?.length) return Response.json({ ok: true, processed: 0, failed: 0 });

        let processed = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of rows) {
          try {
            const dl = await supabase.storage.from("images-private").download(row.storage_path);
            if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download failed");
            const buf = new Uint8Array(await dl.data.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
            const b64 = btoa(bin);
            const dataUrl = `data:${guessMime(row.filename)};base64,${b64}`;
            const r = await keywordOne(dataUrl);
            const { error: upErr } = await supabase
              .from("images")
              .update({
                title: r.title,
                caption: r.description,
                keywords: r.keywords,
                category: r.category,
                keyworded_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            if (upErr) throw new Error(upErr.message);
            processed += 1;
          } catch (e) {
            failed += 1;
            errors.push(`#${row.image_number}: ${(e as Error).message}`);
            console.error("keyword cron failed", row.id, e);
          }
        }

        return Response.json({ ok: true, processed, failed, errors });
      },
    },
  },
});
