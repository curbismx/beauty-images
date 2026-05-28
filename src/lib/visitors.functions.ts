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
  pages?: string[];
  pageCount?: number;
  durationSeconds?: number;
};

export type CountryCount = { country: string; count: number };

export type VisitorStats = {
  recent: VisitorRow[];
  todayCount: number;
  weekCount: number;
  monthCount: number;
  allTimeCount: number;
  countries: CountryCount[];
};

// Normalize country names/codes to ISO-A2 where possible, so the map can match.
const NAME_TO_ISO2: Record<string, string> = {
  "united kingdom": "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  france: "FR",
  germany: "DE",
  netherlands: "NL",
  ireland: "IE",
  spain: "ES",
  italy: "IT",
  canada: "CA",
  australia: "AU",
  "new zealand": "NZ",
  japan: "JP",
  china: "CN",
  india: "IN",
  brazil: "BR",
  mexico: "MX",
  poland: "PL",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  belgium: "BE",
  portugal: "PT",
  switzerland: "CH",
  austria: "AT",
  russia: "RU",
  ukraine: "UA",
  turkey: "TR",
  greece: "GR",
};

function normalizeCountry(c: string | null): string | null {
  if (!c) return null;
  const t = c.trim();
  if (!t) return null;
  if (t.length === 2) return t.toUpperCase();
  const k = t.toLowerCase();
  return NAME_TO_ISO2[k] ?? t;
}

export const getVisitors = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

    const [{ data: recent }, { data: allRows }] = await Promise.all([
      supabase
        .from("visitors")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(100),
      supabase
        .from("visitors")
        .select("ip,visit_date,country")
        .order("visit_date", { ascending: false })
        .limit(10000),
    ]);

    const rows = (allRows ?? []) as { ip: string; visit_date: string; country: string | null }[];

    const todaySet = new Set<string>();
    const weekSet = new Set<string>();
    const monthSet = new Set<string>();
    const allSet = new Set<string>();
    const countryMap = new Map<string, Set<string>>();

    for (const r of rows) {
      allSet.add(r.ip);
      if (r.visit_date >= monthStart) monthSet.add(r.ip);
      if (r.visit_date >= weekStart) weekSet.add(r.ip);
      if (r.visit_date === today) todaySet.add(r.ip);
      const c = normalizeCountry(r.country);
      if (c) {
        if (!countryMap.has(c)) countryMap.set(c, new Set());
        countryMap.get(c)!.add(r.ip);
      }
    }

    const countries: CountryCount[] = Array.from(countryMap.entries())
      .map(([country, ips]) => ({ country, count: ips.size }))
      .sort((a, b) => b.count - a.count);

    // Enrich recent visitors with their page views (count, list, duration),
    // grouped by ip + day to match the existing per-day visitor model.
    const recentRows = (recent ?? []) as VisitorRow[];
    const recentIps = Array.from(new Set(recentRows.map((r) => r.ip)));
    const pvByKey = new Map<string, { path: string | null; at: string }[]>();
    if (recentIps.length) {
      const { data: pvs } = await supabase
        .from("page_views")
        .select("ip, path, created_at")
        .in("ip", recentIps)
        .order("created_at", { ascending: true })
        .limit(8000);
      for (const pv of (pvs ?? []) as {
        ip: string;
        path: string | null;
        created_at: string;
      }[]) {
        const day = pv.created_at.slice(0, 10);
        const key = `${pv.ip}|${day}`;
        if (!pvByKey.has(key)) pvByKey.set(key, []);
        pvByKey.get(key)!.push({ path: pv.path, at: pv.created_at });
      }
    }
    const recentEnriched: VisitorRow[] = recentRows.map((r) => {
      const list = pvByKey.get(`${r.ip}|${r.visit_date}`) ?? [];
      let durationSeconds = 0;
      if (list.length >= 2) {
        durationSeconds = Math.max(
          0,
          Math.round(
            (new Date(list[list.length - 1].at).getTime() -
              new Date(list[0].at).getTime()) /
              1000,
          ),
        );
      }
      return {
        ...r,
        pages: list.map((x) => x.path ?? "—"),
        pageCount: list.length,
        durationSeconds,
      };
    });

    const result: VisitorStats = {
      recent: recentEnriched,
      todayCount: todaySet.size,
      weekCount: weekSet.size,
      monthCount: monthSet.size,
      allTimeCount: allSet.size,
      countries,
    };
    return result;
  });
