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

const TEST_APPEND_LIMIT = 5;

export const searchPublicImages = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        q: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(120).default(60),
      })
      .parse,
  )
  .handler(async ({ data }): Promise<PublicSearchResult[]> => {
    // TEST MODE: ignore the query and return every keyworded image so we
    // can iterate on the detail page across all image types. Restore the
    // proper title/caption/keywords filter + public=true before launch.
    void data;

    const { data: rows, error } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, storage_path")
      .not("keyworded_at", "is", null)
      .order("image_number", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const merged = rows ?? [];

    const paths = merged.map((r) => r.storage_path);
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
      .select("id, image_number, title, caption, keywords, category, pricing_tier, storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const signed = await supabaseAdmin.storage
      .from("images-private")
      .createSignedUrl(row.storage_path, 3600);
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
      .select("id, image_number, title, caption, keywords, storage_path")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    const ordered = data.ids.map((id) => byId.get(id)).filter(Boolean) as Array<
      NonNullable<ReturnType<typeof byId.get>>
    >;

    const paths = ordered.map((r) => r.storage_path);
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

