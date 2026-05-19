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
    if (!raw) return [];
    const tokens = raw.split(/\s+/).filter(Boolean).slice(0, 6);

    let q = supabaseAdmin
      .from("images")
      .select("id, image_number, title, caption, keywords, storage_path")
      .eq("public", true)
      .eq("availability", "available")
      .order("image_number", { ascending: false })
      .limit(data.limit);

    // Match any token across title/caption/keywords
    const orClauses: string[] = [];
    for (const t of tokens) {
      const esc = t.replace(/[%,()]/g, " ");
      orClauses.push(`title.ilike.%${esc}%`);
      orClauses.push(`caption.ilike.%${esc}%`);
      orClauses.push(`keywords.cs.{${esc}}`);
    }
    q = q.or(orClauses.join(","));

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((r) => r.storage_path);
    const signed = paths.length
      ? await supabaseAdmin.storage
          .from("images-private")
          .createSignedUrls(paths, 3600)
      : { data: [] as Array<{ signedUrl: string | null }> };

    return (rows ?? []).map((r, i) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: signed.data?.[i]?.signedUrl ?? null,
    }));
  });
