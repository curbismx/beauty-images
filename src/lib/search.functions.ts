import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Watermarked preview URL — served by /api/public/preview-image/$id.
// Watermark is composited server-side so it's embedded if the file is dragged out.
const previewUrl = (id: string) => `/api/public/preview-image/${id}`;
// Small resized copy for grid thumbnails — far less data than the full preview.
const thumbUrl = (id: string) => `/api/public/preview-image/${id}?w=500`;

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
    z.object({
      q: z.string().trim().min(1).max(120),
      limit: z.number().int().min(1).max(50000).default(50000),
      seed: z.number().int().optional(),
    }).parse,
  )
  .handler(async ({ data }): Promise<PublicSearchResult[]> => {
    const DB_PAGE_SIZE = 1000;
    const term = data.q.trim();
    const terms = term
      .split(/[, ]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (terms.length === 0) return [];

    const primary = terms[0];
    const merged: Array<{
      id: string;
      image_number: number;
      title: string | null;
      caption: string | null;
      keywords: string[] | null;
      preview_path: string | null;
    }> = [];

    for (let from = 0; merged.length < data.limit; from += DB_PAGE_SIZE) {
      const { data: rows, error } = await supabaseAdmin
        .from("images")
        .select("id, image_number, title, caption, keywords, preview_path")
        .eq("public", true)
        .eq("featured", false)
        .not("preview_path", "is", null)
        .or(`title.ilike.%${primary}%,caption.ilike.%${primary}%,keywords.cs.{${primary}}`)
        .order("image_number", { ascending: false })
        .range(from, from + DB_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);

      const pageRows = rows ?? [];
      merged.push(
        ...pageRows.filter((r) => {
          if (!r.preview_path) return false;
          const title = (r.title ?? "").toLowerCase();
          const caption = (r.caption ?? "").toLowerCase();
          const kwords = ((r.keywords ?? []) as string[]).map((k) => k.toLowerCase());
          return terms.every((t) => {
            const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(t)}(?:[^\\p{L}\\p{N}]|$)`, "iu");
            return re.test(title) || re.test(caption) || kwords.some((k) => k === t || re.test(k));
          });
        }),
      );

      if (pageRows.length < DB_PAGE_SIZE) break;
    }

    // --- Section-based shuffle for search variety -------------------------

    // Each shoot is split into small consecutive sections; the sections are
    // then shuffled across the whole result set, so similar images don't clump
    // together and the order differs on every search. Shoots in the preferred
    // range get a soft bias toward the front. The three constants below are
    // safe to change at any time.

    const SECTION_SIZE = 3;        // images per section
    const BOOST_SHOOT_MIN = 136;   // first shoot in the preferred range
    const BOOST_SHOOT_MAX = 214;   // last shoot in the preferred range
    const BOOST_FACTOR = 0.65;     // 1 = no preference; lower = stronger pull forward

    // Group matching rows by shoot (the first 4 digits of the 8-digit number).
    const byShoot = new Map<number, typeof merged>();

    for (const r of merged) {
      const shoot = Math.floor(r.image_number / 10000);
      const group = byShoot.get(shoot);
      if (group) group.push(r);
      else byShoot.set(shoot, [r]);
    }

    // Order each shoot by image number, then cut it into fixed-size sections.
    const sections: Array<{ boosted: boolean; rows: typeof merged }> = [];

    for (const [shoot, rows] of byShoot) {
      rows.sort((a, b) => a.image_number - b.image_number);
      const boosted = shoot >= BOOST_SHOOT_MIN && shoot <= BOOST_SHOOT_MAX;
      for (let i = 0; i < rows.length; i += SECTION_SIZE) {
        sections.push({ boosted, rows: rows.slice(i, i + SECTION_SIZE) });
      }
    }

    // Give each section one fixed random key; preferred sections get a smaller
    // key so they lean toward the front (a nudge, not a guarantee). Sorting by
    // that key shuffles the sections across the whole result set. When a seed
    // is supplied the shuffle is deterministic, so returning to a search shows
    // the exact same order until a new search (with a new seed) is run.
    let rngState = ((data.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
    const rand = () => {
      rngState = (rngState + 0x6d2b79f5) | 0;
      let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const ordered = sections
      .map((s) => ({ s, key: rand() * (s.boosted ? BOOST_FACTOR : 1) }))
      .sort((a, b) => a.key - b.key)
      .flatMap((x) => x.s.rows);

    // Push NUDE/NUDES/NUDITY images into the second half of results, unless the
    // searcher explicitly used one of those keywords.
    const searcherWantsNude = terms.some(
      (t) => t === "nude" || t === "nudes" || t === "nudity",
    );
    let finalOrdered = ordered;
    if (!searcherWantsNude) {
      const isNude = (r: (typeof ordered)[number]) =>
        ((r.keywords ?? []) as string[]).some((k) => {
          const lk = k.toLowerCase();
          return lk === "nude" || lk === "nudes" || lk === "nudity";
        });
      const safe = ordered.filter((r) => !isNude(r));
      const nude = ordered.filter(isNude);
      const half = Math.ceil(ordered.length / 2);
      finalOrdered = [...safe.slice(0, half), ...safe.slice(half), ...nude];
    }

    const limited = finalOrdered.slice(0, data.limit);

    return limited.map((r) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: thumbUrl(r.id),
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
    return {
      id: row.id,
      image_number: row.image_number as number,
      title: row.title,
      caption: row.caption,
      keywords: (row.keywords ?? []) as string[],
      category: row.category,
      pricing_tier: row.pricing_tier,
      signed_url: previewUrl(row.id),
    };
  });

// Resolve catalogue image numbers (e.g. 1370026) to their image ids.
// Used by the homepage favourites to link each preview to its real image.
// Same visibility filters as getPublicImage, so any id returned is openable.
export const getImageIdsByNumbers = createServerFn({ method: "POST" })
  .inputValidator(z.object({ numbers: z.array(z.number().int()).max(200) }).parse)
  .handler(
    async ({ data }): Promise<Array<{ image_number: number; id: string }>> => {
      if (data.numbers.length === 0) return [];
      const { data: rows, error } = await supabaseAdmin
        .from("images")
        .select("id, image_number")
        .in("image_number", data.numbers)
        .eq("public", true)
        .eq("featured", false)
        .not("preview_path", "is", null);
      if (error) throw new Error(error.message);
      return (rows ?? []).map((r) => ({
        image_number: r.image_number as number,
        id: r.id as string,
      }));
    },
  );

export const getPublicImagesByIds = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).max(200) }).parse)
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

    return ordered.map((r) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: thumbUrl(r.id),
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

    return merged.map((r) => ({
      id: r.id,
      image_number: r.image_number as number,
      title: r.title,
      caption: r.caption,
      keywords: (r.keywords ?? []) as string[],
      signed_url: thumbUrl(r.id),
    }));
  });
