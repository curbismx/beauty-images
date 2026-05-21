import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { z } from "zod";

export type PendingImage = {
  id: string;
  image_number: number;
  filename: string;
  storage_path: string;
};

export const getImageStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const db = supabase as any;
    const [{ count: total }, { count: pending }, { count: failed }, { count: uploadErrors }] = await Promise.all([
      supabase.from("images").select("id", { count: "exact", head: true }),
      supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .is("keyworded_at", null),
      supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .not("processing_error", "is", null),
      db.from("upload_errors").select("id", { count: "exact", head: true }),
    ]);
    const totalN = total ?? 0;
    const pendingN = pending ?? 0;
    const failedN = failed ?? 0;
    const uploadErrorsN = uploadErrors ?? 0;
    return {
      total: totalN,
      pending: pendingN,
      keyworded: totalN - pendingN,
      processing: Math.max(0, pendingN - failedN),
      failed: failedN + uploadErrorsN,
      upload_errors: uploadErrorsN,
    };
  });

export const checkImageNumberExists = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ image_number: z.number().int().min(1) }).parse)
  .handler(async ({ data, context }) => {
    const { count, error } = await context.supabase
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("image_number", data.image_number);
    if (error) throw new Error(error.message);
    return { exists: (count ?? 0) > 0 };
  });

export const retryImageProcessing = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("images")
      .update({ processing_attempts: 0, processing_error: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type PendingQueueItem = {
  id: string;
  image_number: number;
  filename: string;
  created_at: string;
  preview_path: string | null;
  processing_attempts: number;
  processing_error: string | null;
  signed_url: string | null;
};

export const getProcessingQueue = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(500).default(200) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, created_at, preview_path, processing_attempts, processing_error")
      .is("keyworded_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.preview_path).filter(Boolean) as string[];
    const signedMap = new Map<string, string | null>();
    if (paths.length) {
      const signed = await supabase.storage.from("images-private").createSignedUrls(paths, 3600);
      (signed.data ?? []).forEach((s, i) => signedMap.set(paths[i], s.signedUrl ?? null));
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      image_number: r.image_number as number,
      filename: r.filename,
      created_at: r.created_at,
      preview_path: r.preview_path,
      processing_attempts: r.processing_attempts ?? 0,
      processing_error: r.processing_error,
      signed_url: r.preview_path ? signedMap.get(r.preview_path) ?? null : null,
    })) as PendingQueueItem[];
  });

export type UploadErrorItem = {
  id: string;
  filename: string;
  storage_path: string | null;
  error_message: string;
  detected_image_number: number | null;
  created_at: string;
  signed_url: string | null;
};

export const createUploadError = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({
      filename: z.string().min(1).max(500),
      storage_path: z.string().min(1).max(500).nullable().optional(),
      error_message: z.string().min(1).max(1000),
      detected_image_number: z.number().int().min(0).max(999999999999).nullable().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("upload_errors").insert({
      filename: data.filename,
      storage_path: data.storage_path ?? null,
      error_message: data.error_message,
      detected_image_number: data.detected_image_number ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listUploadErrors = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(500).default(200) }).parse)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("upload_errors")
      .select("id, filename, storage_path, error_message, detected_image_number, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r: any) => r.storage_path).filter(Boolean) as string[];
    const signed = paths.length
      ? await context.supabase.storage.from("images-private").createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };
    const signedMap = new Map<string, string | null>();
    paths.forEach((p, i) => signedMap.set(p, signed.data?.[i]?.signedUrl ?? null));
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      filename: r.filename,
      storage_path: r.storage_path,
      error_message: r.error_message,
      detected_image_number: r.detected_image_number,
      created_at: r.created_at,
      signed_url: r.storage_path ? signedMap.get(r.storage_path) ?? null : null,
    })) as UploadErrorItem[];
  });

export const deleteUploadErrors = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: rows, error: selErr } = await db
      .from("upload_errors")
      .select("id, storage_path")
      .in("id", data.ids);
    if (selErr) throw new Error(selErr.message);
    const paths = (rows ?? []).map((r: any) => r.storage_path).filter(Boolean) as string[];
    if (paths.length) await context.supabase.storage.from("images-private").remove(paths);
    const { error } = await db.from("upload_errors").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: rows?.length ?? 0 };
  });

export const resolveUploadError = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ id: z.string().uuid(), image_number: z.number().int().min(1).max(99999999) }).parse)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { data: row, error: rowErr } = await db
      .from("upload_errors")
      .select("id, filename, storage_path")
      .eq("id", data.id)
      .single();
    if (rowErr) throw new Error(rowErr.message);
    if (!row.storage_path) throw new Error("No uploaded file is saved for this error — delete it and re-upload the image.");
    const { count, error: dupErr } = await context.supabase
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("image_number", data.image_number);
    if (dupErr) throw new Error(dupErr.message);
    if ((count ?? 0) > 0) throw new Error(`#${String(data.image_number).padStart(8, "0")} already exists`);
    const ext = String(row.filename).split(".").pop()?.toLowerCase() || "jpg";
    const correctedFilename = `A${String(data.image_number).padStart(8, "0")}.${ext}`;
    const { error: insErr } = await context.supabase.from("images").insert({
      filename: correctedFilename,
      storage_path: row.storage_path,
      image_number: data.image_number,
    });
    if (insErr) throw new Error(insErr.message);
    const { error: delErr } = await db.from("upload_errors").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true as const, image_number: data.image_number };
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
  .middleware([requireAdmin])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, title, keyworded_at, created_at, storage_path, preview_path")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.preview_path ?? r.storage_path);
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
  processing_error: string | null;
};

export const listImages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator(
    z
      .object({
        filter: z
          .enum(["all", "pending", "ready", "published", "unpublished", "errors"])
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
        "id, image_number, filename, title, caption, keyworded_at, created_at, storage_path, preview_path, category, availability, public, keywords, processing_error",
      )
      .order("image_number", { ascending: false })
      .limit(data.limit);
    if (data.filter === "pending") q = q.is("keyworded_at", null);
    if (data.filter === "ready") q = q.not("keyworded_at", "is", null).eq("public", false);
    if (data.filter === "published") q = q.eq("public", true);
    if (data.filter === "unpublished") q = q.eq("public", false);
    if (data.filter === "errors") q = q.not("processing_error", "is", null);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${s}%,filename.ilike.%${s}%,category.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.preview_path ?? r.storage_path);
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
      processing_error: r.processing_error,
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
  .middleware([requireAdmin])
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
  .middleware([requireAdmin])
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
  .middleware([requireAdmin])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, storage_path, preview_path, processing_attempts")
      .is("keyworded_at", null)
      .not("preview_path", "is", null)
      .is("processing_error", null)
      .order("image_number", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { processed: 0, failed: 0, errors: [] as string[] };

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const dl = await supabase.storage.from("images-private").download(row.preview_path ?? row.storage_path);
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
            processing_attempts: 0,
            processing_error: null,
          })
          .eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        processed += 1;
      } catch (e) {
        failed += 1;
        const message = (e as Error).message;
        errors.push(`#${row.image_number}: ${message}`);
        await supabase
          .from("images")
          .update({
            processing_attempts: (row.processing_attempts ?? 0) + 1,
            processing_error: message.slice(0, 1000),
          })
          .eq("id", row.id);
      }
    }

    return { processed, failed, errors };
  });

export const publishAllReady = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
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
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("images")
      .update({ public: false })
      .eq("public", true)
      .select("id");
    if (error) throw new Error(error.message);
    return { unpublished: data?.length ?? 0 };
  });

export const deleteImages = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error: selErr } = await supabase
      .from("images")
      .select("id, storage_path, preview_path")
      .in("id", data.ids);
    if (selErr) throw new Error(selErr.message);
    const paths: string[] = [];
    for (const r of rows ?? []) {
      if (r.storage_path) paths.push(r.storage_path);
      if (r.preview_path) paths.push(r.preview_path);
    }
    if (paths.length) {
      await supabase.storage.from("images-private").remove(paths);
    }
    const { error: delErr } = await supabase.from("images").delete().in("id", data.ids);
    if (delErr) throw new Error(delErr.message);
    return { deleted: rows?.length ?? 0 };
  });

export const listImagesMissingPreview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("images")
      .select("id, image_number, filename, storage_path")
      .is("preview_path", null)
      .order("image_number", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r) => r.storage_path);
    const signed = paths.length
      ? await supabase.storage.from("images-private").createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };
    return (rows ?? []).map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      filename: r.filename,
      storage_path: r.storage_path,
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    }));
  });

export const countImagesMissingPreview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("images")
      .select("id", { count: "exact", head: true })
      .is("preview_path", null);
    if (error) throw new Error(error.message);
    return { missing: count ?? 0 };
  });

export const setImagePreviewPath = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator(
    z.object({ id: z.string().uuid(), preview_path: z.string().min(1).max(500) }).parse,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("images")
      .update({ preview_path: data.preview_path })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

