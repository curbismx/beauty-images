import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const TIER_MAX_EDGE: Record<string, number> = {
  small: 800,
  medium: 2000,
  large: 5400,
};

const TIER_PRICE: Record<string, number> = { small: 150, medium: 275, large: 375 };

export interface OrderItem {
  sale_id: string;
  image_id: string;
  image_number: number;
  title: string | null;
  caption: string | null;
  tier: string;
  tier_max_edge: number;
  price: number;
  preview_url: string | null;
}

export interface OrderSummary {
  found: boolean;
  session_id: string;
  email: string | null;
  total: number;
  currency: string;
  items: OrderItem[];
}

export const getOrderBySession = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) => {
    if (typeof data.sessionId !== "string" || !/^cs_[a-zA-Z0-9_]{20,}$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    return data;
  })
  .handler(async ({ data }): Promise<OrderSummary> => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: sales, error } = await supabase
      .from("sales")
      .select("id, image_id, download_tier, amount, currency, created_at")
      .eq("stripe_session_id", data.sessionId)
      .order("created_at", { ascending: true });

    if (error || !sales || sales.length === 0) {
      return {
        found: false,
        session_id: data.sessionId,
        email: null,
        total: 0,
        currency: "GBP",
        items: [],
      };
    }

    const imageIds = Array.from(
      new Set(sales.map((s: any) => s.image_id).filter(Boolean)),
    ) as string[];

    const { data: images } = await supabase
      .from("images")
      .select("id, image_number, title, caption, preview_path, storage_path")
      .in("id", imageIds);

    const imgMap = new Map<string, any>();
    for (const im of images ?? []) imgMap.set(im.id, im);

    const items: OrderItem[] = [];
    let total = 0;
    for (const s of sales as any[]) {
      const im = imgMap.get(s.image_id);
      if (!im) continue;
      const tier = s.download_tier || "medium";
      const previewPath = im.preview_path || im.storage_path;
      let previewUrl: string | null = null;
      if (previewPath) {
        const bucket = im.preview_path ? "featured-images" : "images-private";
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(previewPath, 60 * 60);
        previewUrl = signed?.signedUrl ?? null;
      }
      const price = Number(s.amount) || TIER_PRICE[tier] || 0;
      total += price;
      items.push({
        sale_id: s.id,
        image_id: s.image_id,
        image_number: im.image_number,
        title: im.title,
        caption: im.caption,
        tier,
        tier_max_edge: TIER_MAX_EDGE[tier] ?? 2000,
        price,
        preview_url: previewUrl,
      });
    }

    return {
      found: true,
      session_id: data.sessionId,
      email: null,
      total,
      currency: (sales[0] as any).currency || "GBP",
      items,
    };
  });
