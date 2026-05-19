import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PendingImage = {
  id: string;
  image_number: number;
  filename: string;
  storage_path: string;
};

export const getImageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ count: total }, { count: pending }] = await Promise.all([
      supabase.from("images").select("id", { count: "exact", head: true }),
      supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("keyworded_at", null),
    ]);
    return { total: total ?? 0, pending: pending ?? 0 };
  });

export type RecentImage = {
  id: string;
  image_number: number;
  filename: string;
  title: string | null;
  keyworded_at: string | null;
  created_at: string;
  signed_url: string | null;
};

export const getRecentImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, title, keyworded_at, created_at, storage_path")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.storage_path);
    const signed = paths.length
      ? await supabase.storage.from("images-private").createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }>, error: null };
    return (rows ?? []).map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      filename: r.filename,
      title: r.title,
      keyworded_at: r.keyworded_at,
      created_at: r.created_at,
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    })) as RecentImage[];
  });

export type LibraryImage = RecentImage & {
  caption: string | null;
  category: string | null;
  availability: string;
  public: boolean;
  keywords: string[];
};

export const listImages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        filter: z
          .enum(["all", "pending", "ready", "published", "unpublished"])
          .default("all"),
        search: z.string().trim().max(200).default(""),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("images")
      .select(
        "id, image_number, filename, title, caption, keyworded_at, created_at, storage_path, category, availability, public, keywords",
      )
      .order("image_number", { ascending: false })
      .limit(data.limit);
    if (data.filter === "pending") q = q.is("keyworded_at", null);
    if (data.filter === "ready") q = q.not("keyworded_at", "is", null).eq("public", false);
    if (data.filter === "published") q = q.eq("public", true);
    if (data.filter === "unpublished") q = q.eq("public", false);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${s}%,filename.ilike.%${s}%,category.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.storage_path);
    const signed = paths.length
      ? await supabase.storage.from("images-private").createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };
    return (rows ?? []).map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      filename: r.filename,
      title: r.title,
      caption: r.caption,
      keyworded_at: r.keyworded_at,
      created_at: r.created_at,
      category: r.category,
      availability: r.availability,
      public: r.public,
      keywords: (r.keywords ?? []) as string[],
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    })) as LibraryImage[];
  });

export type ImageDetail = {
  id: string;
  image_number: number;
  filename: string;
  title: string | null;
  caption: string | null;
  keywords: string[];
  category: string | null;
  availability: string;
  pricing_tier: string | null;
  model_release: boolean;
  admin_notes: string | null;
  featured: boolean;
  public: boolean;
  keyworded_at: string | null;
  created_at: string;
  signed_url: string | null;
};

export const getImage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("images")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const signed = await supabase.storage
      .from("images-private")
      .createSignedUrl(row.storage_path, 3600);
    return {
      id: row.id,
      image_number: row.image_number as number,
      filename: row.filename,
      title: row.title,
      caption: row.caption,
      keywords: (row.keywords ?? []) as string[],
      category: row.category,
      availability: row.availability,
      pricing_tier: row.pricing_tier,
      model_release: row.model_release,
      admin_notes: row.admin_notes,
      featured: row.featured,
      public: row.public,
      keyworded_at: row.keyworded_at,
      created_at: row.created_at,
      signed_url: signed.data?.signedUrl ?? null,
    } as ImageDetail;
  });

export const updateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title: z.string().max(240).nullable().optional(),
      caption: z.string().max(2000).nullable().optional(),
      keywords: z.array(z.string().min(1).max(60)).max(60).optional(),
      category: z.string().max(50).nullable().optional(),
      availability: z.enum(["available", "on_hold", "licensed"]).optional(),
      pricing_tier: z.string().max(50).nullable().optional(),
      model_release: z.boolean().optional(),
      admin_notes: z.string().max(5000).nullable().optional(),
      featured: z.boolean().optional(),
      public: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("images").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const KEYWORD_PROMPT = `You are a professional stock-photo keyworder. Analyze the image and return strict JSON with this exact shape:
{
  "title": "short descriptive headline, max 12 words, no trailing period",
  "description": "1-2 sentence natural caption suitable as alt text",
  "keywords": ["20 to 30 single or short multi-word stock keywords, lowercase, no duplicates"],
  "category": "one of: Nature, Portrait, Lifestyle, Architecture, Travel, Food, Business, Fashion, Abstract, Sport, Animal, Other"
}
Return ONLY the JSON object, no markdown, no commentary.`;

async function keywordOne(dataUrl: string): Promise<{
  title: string;
  description: string;
  keywords: string[];
  category: string;
} | null> {
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
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
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

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export const keywordPendingBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, storage_path")
      .is("keyworded_at", null)
      .order("image_number", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { processed: 0, failed: 0, errors: [] as string[] };

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const dl = await supabase.storage.from("images-private").download(row.storage_path);
        if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download failed");
        const buf = Buffer.from(await dl.data.arrayBuffer());
        const dataUrl = `data:${guessMime(row.filename)};base64,${buf.toString("base64")}`;
        const result = await keywordOne(dataUrl);
        if (!result) throw new Error("empty AI response");
        const { error: upErr } = await supabase
          .from("images")
          .update({
            title: result.title,
            caption: result.description,
            keywords: result.keywords,
            category: result.category,
            keyworded_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        processed += 1;
      } catch (e) {
        failed += 1;
        errors.push(`#${row.image_number}: ${(e as Error).message}`);
      }
    }

    return { processed, failed, errors };
  });

export const publishAllReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("images")
      .update({ public: true })
      .not("keyworded_at", "is", null)
      .eq("public", false)
      .select("id");
    if (error) throw new Error(error.message);
    return { published: data?.length ?? 0 };
  });

export const unpublishAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("images")
      .update({ public: false })
      .eq("public", true)
      .select("id");
    if (error) throw new Error(error.message);
    return { unpublished: data?.length ?? 0 };
  });
