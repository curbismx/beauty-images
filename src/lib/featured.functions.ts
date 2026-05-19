import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FeaturedImage = {
  id: string;
  filename: string;
  storage_path: string;
  sort_order: number;
  url: string;
};

export const listFeatured = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("featured_images")
      .select("id, filename, storage_path, sort_order")
      .order("filename", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      ...r,
      url: context.supabase.storage.from("featured-images").getPublicUrl(r.storage_path).data.publicUrl,
    })) as FeaturedImage[];
  });

export const reorderFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse)
  .handler(async ({ data, context }) => {
    // Assign sort_order so that index 0 (top of list) gets the highest value.
    const total = data.ids.length;
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("featured_images")
        .update({ sort_order: total - i })
        .eq("id", data.ids[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const deleteFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("featured_images")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row?.storage_path) {
      await context.supabase.storage.from("featured-images").remove([row.storage_path]);
    }
    const del = await context.supabase.from("featured_images").delete().eq("id", data.id);
    if (del.error) throw new Error(del.error.message);
    return { ok: true as const };
  });
