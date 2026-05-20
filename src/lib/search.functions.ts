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
    const raw = data.q.replace(/[%,]/g, " ").trim();
    const tokens = raw.split(/\s+/).filter(Boolean).slice(0, 6);

    // NOTE: test mode — public filter intentionally removed so unpublished
    // images appear in results. Restore .eq("public", true) before launch.
    let q = supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, storage_path")
      .eq("availability", "available")
      .order("image_number", { ascending: false })
      .limit(data.limit);

    if (tokens.length) {
      const orClauses: string[] = [];
      for (const t of tokens) {
        const esc = t.replace(/[%,()]/g, " ");
        orClauses.push(`title.ilike.%${esc}%`);
        orClauses.push(`caption.ilike.%${esc}%`);
        orClauses.push(`keywords.cs.{${esc}}`);
      }
      q = q.or(orClauses.join(","));
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Test mode: always append the latest N images to every search so we
    // have something to click into while building the detail page.
    const haveIds = new Set((rows ?? []).map((r) => r.id));
    const { data: extras } = await supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, storage_path")
      .order("image_number", { ascending: false })
      .limit(TEST_APPEND_LIMIT);
    const merged = [
      ...(rows ?? []),
      ...((extras ?? []).filter((r) => !haveIds.has(r.id))),
    ];

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
