import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicSearchResult = {
  id: string;
  image_number: number;
  title: string | null;
  caption: string | null;
  keywords: string[];
  signed_url: string | null;
};

export type PublicImageDetail = {
  id: string;
  image_number: number;
  title: string | null;
  caption: string | null;
  keywords: string[];
  category: string | null;
  pricing_tier: string | null;
  signed_url: string | null;
};

export const searchPublicImages = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        q: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(50000).default(50000),
      })
      .parse,
  )
  .handler(async ({ data }): Promise<PublicSearchResult[]> => {
    const term = data.q.trim();
    // Split on commas or spaces, trim, and filter empty terms
    const terms = term
      .split(/[, ]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (terms.length === 0) return [];

    // Fetch all matching rows using the first term as the broad filter
    const primary = terms[1];
    const { data: rows, error } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, preview_path")
      .eq("public", true)
      .eq("featured", false)
      .not("preview_path", "is", null)
      .or(
        `title.ilike.%${primary}%,caption.ilike.%${primary}%,keywords.cs.{${primary}}`,
      )
      .order("image_number", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    // Client-side filter: every term must match at least one field
    const merged = (rows ?? []).filter((r) => {
      if (!r.preview_path) return false;
      const title = (r.title ?? "").toLowerCase();
      const caption = (r.caption ?? "").toLowerCase();
      const kwords = ((r.keywords ?? []) as string[]).map((k) => k.toLowerCase());
      return terms.every(
        (t) =>
          title.includes(t) ||
          caption.includes(t) ||
          kwords.some((k) => k.includes(t)),
      );
    });
    const paths = merged.map((r) => r.preview_path as string);
    const signed = paths.length
      ? await supabaseAdmin.storage
          .from("images-private")
          .createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };

    return merged.map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    }));
  });

export const getPublicImage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }): Promise<PublicImageDetail | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, category, pricing_tier, preview_path")
      .eq("id", data.id)
      .eq("public", true)
      .eq("featured", false)
      .not("preview_path", "is", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.preview_path) return null;
    const signed = await supabaseAdmin.storage
      .from("images-private")
      .createSignedUrl(row.preview_path, 3600);
    return {
      id: row.id,
      image_number: row.image_number as number,
      title: row.title,
      caption: row.caption,
      keywords: (row.keywords ?? []) as string[],
      category: row.category,
      pricing_tier: row.pricing_tier,
      signed_url: signed.data?.signedUrl ?? null,
    };
  });

export const getPublicImagesByIds = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ ids: z.array(z.string().uuid()).max(200) }).parse,
  )
  .handler(async ({ data }): Promise<PublicSearchResult[]> => {
    if (data.ids.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, preview_path")
      .in("id", data.ids)
      .eq("public", true)
      .eq("featured", false)
      .not("preview_path", "is", null);
    if (error) throw new Error(error.message);

    const byId = new Map((rows ?? []).filter((r) => !!r.preview_path).map((r) => [r.id, r]));
    const ordered = data.ids.map((id) => byId.get(id)).filter(Boolean) as Array<
      NonNullable<ReturnType<typeof byId.get>>
    >;

    const paths = ordered.map((r) => r.preview_path as string);
    const signed = paths.length
      ? await supabaseAdmin.storage
          .from("images-private")
          .createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };

    return ordered.map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    }));
  });

export const getSimilarShootImages = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      excludeId: z.string().uuid(),
      imageNumber: z.number().int().nonnegative(),
    }).parse,
  )
  .handler(async ({ data }): Promise<PublicSearchResult[]> => {
    // First 4 digits of an 8-digit padded number = shoot id.
    const shoot = Math.floor(data.imageNumber / 10000);
    const min = shoot * 10000;
    const max = min + 9999;

    const { data: rows, error } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, preview_path")
      .gte("image_number", min)
      .lte("image_number", max)
      .neq("id", data.excludeId)
      .eq("public", true)
      .eq("featured", false)
      .not("preview_path", "is", null)
      .order("image_number", { ascending: true })
      .limit(60);
    if (error) throw new Error(error.message);
    const merged = (rows ?? []).filter((r) => !!r.preview_path);
    if (merged.length === 0) return [];

    const paths = merged.map((r) => r.preview_path as string);
    const signed = await supabaseAdmin.storage
      .from("images-private")
      .createSignedUrls(paths, 3600);

    return merged.map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    }));
  });



