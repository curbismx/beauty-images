import { createClient } from "@supabase/supabase-js";
import * as art from "./artDirectors.server";

// The private link the Curbism admin (curbism.com/admin) uses to read this
// site's figures. Only the Curbism server can call it: every request must
// carry the shared CURBISM_LINK_KEY secret, set in both projects.

const SITE_URL = "https://beautyimages.com";
const ADMIN_EMAIL = "mail@curbism.com";

// The admin pages the Curbism admin may open here already signed in.
const ADMIN_PAGES = new Set([
  "/admin",
  "/admin/library",
  "/admin/upload",
  "/admin/featured",
  "/admin/agents",
  "/admin/sales",
  "/admin/customers",
  "/admin/settings",
]);

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Body = { action?: string; days?: number; next?: string } & Record<string, unknown>;

export async function handleCurbism(request: Request): Promise<Response> {
  const key = process.env.CURBISM_LINK_KEY;
  if (!key) return json({ error: "CURBISM_LINK_KEY is not set on Beauty Images." }, 503);
  const sent = request.headers.get("x-curbism-key") ?? "";
  if (!sameKey(sent, key)) return json({ error: "Not allowed." }, 401);

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  try {
    switch (body.action) {
      case "summary":
        return json(await summary());
      case "visits":
        return json(await visits(Number(body.days) || 30));
      case "sales":
        return json(await sales());
      case "customers":
        return json(await customers());
      case "sso":
        return json(await signInLink(String(body.next ?? "/admin")));
      case "art_list":
        return json(await art.list());
      case "art_search":
        return json(await art.search(body));
      case "art_bring_in":
        return json(await art.bringIn(body));
      case "art_update":
        return json(await art.update(body));
      case "art_delete":
        return json(await art.remove(body));
      case "art_settings":
        return json(await art.saveSettings(body));
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    if (e instanceof art.ArtError) return json({ error: e.message }, e.status);
    console.error("[curbism]", e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong." }, 500);
  }
}

// ---------- Figures for column 1 and 2 ----------

async function summary() {
  const sb = db();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [v, published, saleRows, profileCount, artDirectors] = await Promise.all([
    sb.rpc("curbism_visits", { p_days: 30 }),
    sb.from("images").select("id", { count: "exact", head: true }).eq("public", true),
    sb.from("sales").select("amount, currency, created_at, status, stripe_session_id").limit(1000),
    sb.from("profiles").select("id", { count: "exact", head: true }),
    art.count(),
  ]);
  if (v.error) throw new Error(v.error.message);

  const rows = (saleRows.data ?? []) as {
    amount: number | null;
    currency: string;
    created_at: string;
    status: string;
    stripe_session_id: string | null;
  }[];
  const done = rows.filter((r) => r.status === "completed" && isLive(r.stripe_session_id));
  const monthTotals: Record<string, number> = {};
  for (const r of done) {
    if (new Date(r.created_at) >= monthStart) {
      const c = (r.currency || "gbp").toUpperCase();
      monthTotals[c] = (monthTotals[c] ?? 0) + (Number(r.amount) || 0);
    }
  }
  const tiles = (v.data as { tiles: { month: number } }).tiles;

  return {
    visitorsMonth: tiles.month,
    imagesPublished: published.count ?? 0,
    salesCount: done.length,
    salesMonth: monthTotals,
    accounts: profileCount.count ?? 0,
    artDirectors,
  };
}

// ---------- Visits ----------

type VisitorRow = {
  ip: string;
  visit_date: string;
  country: string | null;
  city: string | null;
  referer: string | null;
  path: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

async function visits(days: number) {
  const sb = db();
  const allowed = [1, 7, 30, 365];
  const n = allowed.includes(days) ? days : 30;

  const [stats, recentRes] = await Promise.all([
    sb.rpc("curbism_visits", { p_days: n }),
    sb
      .from("visitors")
      .select("ip, visit_date, country, city, referer, path, first_seen_at, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(50),
  ]);
  if (stats.error) throw new Error(stats.error.message);

  const recent = (recentRes.data ?? []) as VisitorRow[];
  const ips = Array.from(new Set(recent.map((r) => r.ip)));
  const byKey = new Map<string, { path: string; at: string }[]>();
  if (ips.length) {
    const { data: pvs } = await sb
      .from("page_views")
      .select("ip, path, created_at")
      .in("ip", ips)
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const p of (pvs ?? []) as { ip: string; path: string | null; created_at: string }[]) {
      const k = `${p.ip}|${p.created_at.slice(0, 10)}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push({ path: p.path || "/", at: p.created_at });
    }
  }

  return {
    ...(stats.data as object),
    recent: recent.map((r) => {
      const list = (byKey.get(`${r.ip}|${r.visit_date}`) ?? []).slice().reverse();
      const seconds =
        list.length >= 2
          ? Math.max(0, Math.round((Date.parse(list[list.length - 1].at) - Date.parse(list[0].at)) / 1000))
          : 0;
      return {
        when: r.last_seen_at,
        country: r.country,
        city: r.city,
        referer: r.referer,
        firstPage: r.path,
        pages: list.map((x) => x.path),
        seconds,
      };
    }),
  };
}

// ---------- Sales ----------

async function sales() {
  const sb = db();
  const { data, error } = await sb
    .from("sales")
    .select(
      "id, created_at, amount, currency, status, image_id, user_id, customer_id, usage_type, territory, duration_months, exclusivity, download_tier, license_starts, license_ends, discount_amount, agent_code, download_count",
    )
    .like("stripe_session_id", "cs_live_%")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];

  const imageIds = uniq(rows.map((r) => r.image_id as string | null));
  const userIds = uniq(rows.map((r) => r.user_id as string | null));
  const customerIds = uniq(rows.map((r) => r.customer_id as string | null));

  const [imgs, profs, custs] = await Promise.all([
    imageIds.length
      ? sb.from("images").select("id, image_number, title").in("id", imageIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? sb.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? sb.from("customers").select("id, email, name, company").in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const img = new Map(((imgs.data ?? []) as { id: string; image_number: number; title: string | null }[]).map((i) => [i.id, i]));
  const prof = new Map(((profs.data ?? []) as { id: string; email: string | null; full_name: string | null }[]).map((p) => [p.id, p]));
  const cust = new Map(((custs.data ?? []) as { id: string; email: string; name: string | null; company: string | null }[]).map((c) => [c.id, c]));

  return {
    sales: rows.map((r) => {
      const i = img.get(r.image_id as string);
      const p = prof.get(r.user_id as string);
      const c = cust.get(r.customer_id as string);
      return {
        ...r,
        imageNumber: i?.image_number ?? null,
        imageTitle: i?.title ?? null,
        email: c?.email ?? p?.email ?? null,
        name: c?.name ?? p?.full_name ?? null,
        company: c?.company ?? null,
      };
    }),
  };
}

// ---------- Customers ----------

async function customers() {
  const sb = db();
  const [profs, custs, saleRows] = await Promise.all([
    sb.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }).limit(1000),
    sb.from("customers").select("id, email, name, company, industry, created_at").order("created_at", { ascending: false }).limit(1000),
    sb.from("sales").select("user_id, customer_id, amount, currency, status, created_at, stripe_session_id").limit(1000),
  ]);

  type Person = {
    email: string;
    name: string | null;
    company: string | null;
    industry: string | null;
    joined: string;
    account: boolean;
    purchases: number;
    spent: Record<string, number>;
    lastPurchase: string | null;
  };
  const people = new Map<string, Person>();
  const userEmail = new Map<string, string>();
  const custEmail = new Map<string, string>();

  for (const p of (profs.data ?? []) as { id: string; email: string | null; full_name: string | null; created_at: string }[]) {
    if (!p.email) continue;
    const e = p.email.toLowerCase();
    userEmail.set(p.id, e);
    people.set(e, {
      email: p.email, name: p.full_name, company: null, industry: null, joined: p.created_at,
      account: true, purchases: 0, spent: {}, lastPurchase: null,
    });
  }
  for (const c of (custs.data ?? []) as { id: string; email: string; name: string | null; company: string | null; industry: string | null; created_at: string }[]) {
    const e = c.email.toLowerCase();
    custEmail.set(c.id, e);
    const had = people.get(e);
    if (had) {
      had.name = had.name ?? c.name;
      had.company = c.company;
      had.industry = c.industry;
      if (c.created_at < had.joined) had.joined = c.created_at;
    } else {
      people.set(e, {
        email: c.email, name: c.name, company: c.company, industry: c.industry, joined: c.created_at,
        account: false, purchases: 0, spent: {}, lastPurchase: null,
      });
    }
  }
  for (const s of (saleRows.data ?? []) as {
    user_id: string | null;
    customer_id: string | null;
    amount: number | null;
    currency: string;
    status: string;
    created_at: string;
    stripe_session_id: string | null;
  }[]) {
    if (s.status !== "completed" || !isLive(s.stripe_session_id)) continue;
    const e = (s.customer_id && custEmail.get(s.customer_id)) || (s.user_id && userEmail.get(s.user_id)) || null;
    const who = e ? people.get(e) : undefined;
    if (!who) continue;
    who.purchases += 1;
    const c = (s.currency || "gbp").toUpperCase();
    who.spent[c] = (who.spent[c] ?? 0) + (Number(s.amount) || 0);
    if (!who.lastPurchase || s.created_at > who.lastPurchase) who.lastPurchase = s.created_at;
  }

  return {
    customers: Array.from(people.values()).sort((a, b) => (a.joined < b.joined ? 1 : -1)),
  };
}

// ---------- Open this site's admin already signed in ----------

async function signInLink(next: string) {
  const page = ADMIN_PAGES.has(next) ? next : "/admin";
  const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL });
  if (error) throw new Error(error.message);
  const token = data.properties?.hashed_token;
  if (!token) throw new Error("No sign-in link was made.");
  const url = `${SITE_URL}/admin-sso?t=${encodeURIComponent(token)}&next=${encodeURIComponent(page)}`;
  return { url };
}

// Only payments taken through Stripe's live mode count as sales. Test
// payments (made while the checkout was being set up) have session ids that
// start "cs_test_", live ones "cs_live_".
function isLive(sessionId: unknown): boolean {
  return typeof sessionId === "string" && sessionId.startsWith("cs_live_");
}

function uniq(list: (string | null)[]): string[] {
  return Array.from(new Set(list.filter((x): x is string => !!x)));
}
