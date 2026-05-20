import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";

export type VisitorRow = {
  id: string;
  ip: string;
  visit_date: string;
  country: string | null;
  city: string | null;
  region: string | null;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export const getVisitors = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: recent }, { data: todayRows }, { count: total30 }] = await Promise.all([
      supabase
        .from("visitors")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(100),
      supabase.from("visitors").select("id", { count: "exact" }).eq("visit_date", today),
      supabase
        .from("visitors")
        .select("id", { count: "exact", head: true })
        .gte("visit_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    ]);

    return {
      recent: (recent ?? []) as VisitorRow[],
      todayCount: todayRows?.length ?? 0,
      last30Count: total30 ?? 0,
    };
  });
