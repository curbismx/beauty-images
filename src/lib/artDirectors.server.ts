import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Art directors: people found through Apollo, kept here for Beauty Images and
// worked from the Curbism admin over its private link (curbism.server.ts).
// The Apollo key (APOLLO_API_KEY, a master key) lives in this project's
// secrets and never leaves the server. Searching Apollo is free; bringing
// someone in fills them in for about 1 credit.

type Json = Record<string, unknown>;

const APOLLO = "https://api.apollo.io/api/v1";
const PER_PAGE = 100;
/** Apollo shows at most 500 pages of a search. */
const MOST_PAGES = 500;
const APOLLO_ID = /^[a-zA-Z0-9]{8,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "art-contact-photos";
const PHOTO_MOST_BYTES = 1_500_000;

export class ArtError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strings = (v: unknown, most = 25) =>
  Array.isArray(v)
    ? v
        .map(str)
        .filter((s) => s !== "" && s.length <= 120)
        .slice(0, most)
    : [];

/* ------------------------------------------------------------ fields */

export type FieldType = "text" | "number" | "email" | "phone" | "link" | "date" | "choice" | "tick" | "picture" | "light";

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  /** Shown on a person's page. Switched off, it is kept but not shown. */
  on: boolean;
  /** Shown in the list too, under each name; a picture shows on the left. */
  list: boolean;
  /** A Choice field's choices, in order. */
  choices?: string[];
  /** One of Apollo's own: it can be hidden but not deleted. */
  apollo?: boolean;
}

/** What the folder starts with: Apollo's details, the most useful in the list. */
export const DEFAULT_FIELDS: Field[] = [
  { id: "picture", name: "Picture", type: "picture", on: true, list: true, apollo: true },
  // Where the email to them is: waiting, sent, come back, or no more. Set by the sending, not by hand.
  { id: "email_status", name: "Email", type: "light", on: true, list: true, apollo: true },
  { id: "title", name: "Job title", type: "text", on: true, list: true, apollo: true },
  { id: "company", name: "Company", type: "text", on: true, list: true, apollo: true },
  { id: "email", name: "Email address", type: "email", on: true, list: false, apollo: true },
  { id: "location", name: "Location", type: "text", on: true, list: true, apollo: true },
  { id: "linkedin", name: "LinkedIn", type: "link", on: true, list: false, apollo: true },
  { id: "phone", name: "Work phone", type: "phone", on: true, list: false, apollo: true },
  { id: "industry", name: "Industry", type: "text", on: true, list: false, apollo: true },
  { id: "size", name: "Company size", type: "number", on: true, list: false, apollo: true },
  { id: "website", name: "Website", type: "link", on: true, list: false, apollo: true },
];

const TYPES: FieldType[] = ["text", "number", "email", "phone", "link", "date", "choice", "tick", "picture", "light"];

/** The settings as sent, checked: Apollo's fields always there, nothing odd let through. */
function cleanFields(raw: unknown): Field[] {
  if (!Array.isArray(raw)) throw new ArtError("Bad settings.");
  const out: Field[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, 40)) {
    const f = (r ?? {}) as Json;
    const id = str(f["id"]);
    if (!/^[a-z0-9_]{1,40}$/.test(id) || seen.has(id)) continue;
    const known = DEFAULT_FIELDS.find((d) => d.id === id);
    const type = known ? known.type : (str(f["type"]) as FieldType);
    if (!TYPES.includes(type) || ((type === "picture" || type === "light") && !known)) continue;
    const name = str(f["name"]).slice(0, 60) || known?.name || "Untitled";
    const field: Field = { id, name, type, on: f["on"] !== false, list: f["list"] === true };
    if (known) field.apollo = true;
    if (type === "choice") {
      field.choices = strings(f["choices"], 30).map((c) => c.slice(0, 60));
    }
    seen.add(id);
    out.push(field);
  }
  // Apollo's own can be hidden, never lost. The Email light, when it is new
  // to these settings, goes in near the top, shown.
  for (const d of DEFAULT_FIELDS) {
    if (seen.has(d.id)) continue;
    if (d.id === "email_status") {
      const at = out.findIndex((f) => f.id === "picture") + 1;
      out.splice(at, 0, { ...d });
    } else out.push({ ...d, on: false, list: false });
  }
  return out;
}

async function readFields(sb: SupabaseClient): Promise<Field[]> {
  const { data, error } = await sb.from("art_settings").select("fields").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_FIELDS;
  try {
    return cleanFields((data as { fields: unknown }).fields);
  } catch {
    return DEFAULT_FIELDS;
  }
}

export async function saveSettings(body: Json) {
  const fields = cleanFields(body["fields"]);
  const { error } = await db()
    .from("art_settings")
    .upsert({ id: 1, fields, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { fields };
}

/* ------------------------------------------------------------ people */

interface Row {
  id: string;
  apollo_id: string | null;
  name: string;
  details: Json;
  notes: string;
  photo_path: string | null;
  last_emailed_at: string | null;
  unsubscribed_at: string | null;
  queued_at: string | null;
  bounced_at: string | null;
  bounce_note: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, apollo_id, name, details, notes, photo_path, last_emailed_at, unsubscribed_at, queued_at, bounced_at, bounce_note, created_at, updated_at";

/** A row as the Curbism admin takes it: its details as "values", and a link to its photo. */
function shape(r: Row, photos: Map<string, string>) {
  const { details, ...rest } = r;
  return { ...rest, values: details ?? {}, photo: r.photo_path ? (photos.get(r.photo_path) ?? null) : null };
}

/** Everyone, newest first, with a link to each photo that works for a day. */
export async function list() {
  const sb = db();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("art_contacts")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const fields = await readFields(sb);
  const photos = await photoLinks(sb, rows.map((r) => r.photo_path).filter((p): p is string => !!p));
  return {
    fields,
    contacts: rows.map((r) => shape(r, photos)),
  };
}

async function photoLinks(sb: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 500) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 500), 86400);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  }
  return out;
}

/** A value as a field takes it: words, a number, a day, a choice or a tick. */
function cleanValue(field: Field, v: unknown): string | number | boolean | null {
  if (v === null || v === undefined || v === "") return null;
  switch (field.type) {
    case "tick":
      return v === true;
    case "number": {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "date": {
      const s = str(v);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }
    case "choice": {
      const s = str(v);
      return field.choices?.includes(s) ? s : null;
    }
    case "picture":
      return null;
    default:
      return str(v).slice(0, 2000) || null;
  }
}

/** Changes one person: their name, notes, or any of their details. */
export async function update(body: Json) {
  const id = str(body["id"]);
  if (!UUID.test(id)) throw new ArtError("Bad request.");
  const sb = db();
  const { data: had, error: readError } = await sb.from("art_contacts").select(COLUMNS).eq("id", id).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!had) throw new ArtError("That person has gone.", 404);
  const row = had as unknown as Row;
  const patch: Json = { updated_at: new Date().toISOString() };
  if (typeof body["name"] === "string") patch["name"] = str(body["name"]).slice(0, 200);
  if (typeof body["notes"] === "string") patch["notes"] = String(body["notes"]).slice(0, 20000);
  const changes = body["values"];
  if (changes && typeof changes === "object" && !Array.isArray(changes)) {
    const fields = await readFields(sb);
    const values = { ...(row.details ?? {}) } as Json;
    for (const [key, v] of Object.entries(changes as Json)) {
      const field = fields.find((f) => f.id === key);
      if (!field) continue;
      const clean = cleanValue(field, v);
      if (clean === null || clean === false) delete values[key];
      else values[key] = clean;
    }
    patch["details"] = values;
  }
  const { data, error } = await sb.from("art_contacts").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  const saved = data as unknown as Row;
  const photos = saved.photo_path ? await photoLinks(sb, [saved.photo_path]) : new Map<string, string>();
  return { contact: shape(saved, photos) };
}

/** Deletes people, with their photos. */
export async function remove(body: Json) {
  const ids = (Array.isArray(body["ids"]) ? body["ids"] : [body["id"]]).map(str).filter((x) => UUID.test(x)).slice(0, 500);
  if (ids.length === 0) throw new ArtError("Bad request.");
  const sb = db();
  const { data, error } = await sb.from("art_contacts").select("id, photo_path").in("id", ids);
  if (error) throw new Error(error.message);
  const paths = ((data ?? []) as { photo_path: string | null }[]).map((r) => r.photo_path).filter((p): p is string => !!p);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const { error: delError } = await sb.from("art_contacts").delete().in("id", ids);
  if (delError) throw new Error(delError.message);
  return { deleted: ids.length };
}

/* ------------------------------------------------------------ Apollo */

function apolloKey(): string {
  const key = process.env.APOLLO_API_KEY ?? "";
  if (!key) throw new ArtError("Apollo isn't connected yet: add the APOLLO_API_KEY secret in the Beauty Images project.", 503);
  return key;
}

async function apollo(
  path: string,
  init: { query?: URLSearchParams; json?: unknown },
): Promise<{ status: number; data: Json | null }> {
  const key = apolloKey();
  const qs = init.query && [...init.query.keys()].length > 0 ? `?${init.query.toString()}` : "";
  let res: Response;
  try {
    res = await fetch(`${APOLLO}${path}${qs}`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        accept: "application/json",
      },
      body: JSON.stringify(init.json ?? {}),
    });
  } catch {
    throw new ArtError("Apollo couldn't be reached. Try again in a moment.", 502);
  }
  const text = await res.text();
  let data: Json | null = null;
  try {
    data = text ? (JSON.parse(text) as Json) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

/** Apollo's own trouble, in words. */
function trouble(status: number, data: Json | null): ArtError {
  const said = typeof data?.["error"] === "string" ? (data["error"] as string) : "";
  if (status === 429) return new ArtError("Apollo is busy. Try again in a minute.", 429);
  if (status === 401) return new ArtError("Apollo didn't accept the key.", 502);
  if (status === 403)
    return new ArtError(said || "Apollo said no: the key needs to be a master key, or the plan doesn't allow this.", 502);
  if (status === 422) return new ArtError(said || "Apollo didn't understand that search.", 400);
  return new ArtError(said || `Apollo replied ${status}.`, 502);
}

/** One page of Apollo's search: first names, hidden surnames, job titles and companies. Free. */
export async function search(body: Json) {
  const f = (body["filters"] ?? {}) as Json;
  const page = Math.min(Math.max(Math.floor(Number(body["page"]) || 1), 1), MOST_PAGES);
  const q = new URLSearchParams();
  for (const t of strings(f["titles"])) q.append("person_titles[]", t);
  for (const l of strings(f["locations"])) q.append("person_locations[]", l);
  for (const i of strings(f["industries"])) q.append("organization_industries[]", i);
  for (const s of strings(f["sizes"]).filter((s) => /^\d+,\d+$/.test(s))) q.append("organization_num_employees_ranges[]", s);
  for (const s of strings(f["seniorities"]).filter((s) => /^[a-z_]+$/.test(s))) q.append("person_seniorities[]", s);
  const keywords = str(f["keywords"]).slice(0, 200);
  if (keywords) q.set("q_keywords", keywords);
  if ([...q.keys()].length === 0) throw new ArtError("Set at least one filter first.");
  q.set("page", String(page));
  q.set("per_page", String(PER_PAGE));
  const { status, data } = await apollo("/mixed_people/api_search", { query: q });
  if (status !== 200 || !data) throw trouble(status, data);
  const people = Array.isArray(data["people"]) ? (data["people"] as Json[]) : [];
  return {
    total: Number(data["total_entries"]) || 0,
    people: people.map((p) => {
      const org = (p["organization"] ?? {}) as Json;
      return {
        id: str(p["id"]),
        firstName: str(p["first_name"]),
        lastHidden: str(p["last_name_obfuscated"]),
        title: str(p["title"]),
        company: str(org["name"]),
        hasEmail: p["has_email"] === true,
        hasPhone: p["has_direct_phone"] === true || p["has_direct_phone"] === "Yes",
      };
    }),
  };
}

/**
 * Brings up to ten people in: Apollo fills each in (about 1 credit each,
 * only when it finds them), their photo is kept here, and they are saved.
 * Anyone already here is left as they are and costs nothing.
 */
export async function bringIn(body: Json) {
  const asked = strings(body["ids"], 10).filter((id) => APOLLO_ID.test(id));
  if (asked.length === 0) throw new ArtError("No one to bring in.");
  const sb = db();
  const { data: had, error: hadError } = await sb.from("art_contacts").select("apollo_id").in("apollo_id", asked);
  if (hadError) throw new Error(hadError.message);
  const already = new Set(((had ?? []) as { apollo_id: string }[]).map((r) => r.apollo_id));
  const ids = asked.filter((id) => !already.has(id));
  if (ids.length === 0) return { added: [], missing: [], already: asked, credits: 0 };

  const q = new URLSearchParams({ reveal_personal_emails: "false", reveal_phone_number: "false" });
  const { status, data } = await apollo("/people/bulk_match", { query: q, json: { details: ids.map((id) => ({ id })) } });
  if (status !== 200 || !data) throw trouble(status, data);
  const matches = (Array.isArray(data["matches"]) ? (data["matches"] as (Json | null)[]) : []).filter(
    (m): m is Json => !!m && typeof m === "object" && APOLLO_ID.test(str(m["id"])),
  );

  const rows = await Promise.all(matches.map((m) => rowOf(sb, m)));
  if (rows.length) {
    const { error } = await sb.from("art_contacts").upsert(rows, { onConflict: "apollo_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const found = new Set(rows.map((r) => r.apollo_id));
  return {
    added: rows.map((r) => r.apollo_id),
    missing: ids.filter((id) => !found.has(id)),
    already: [...already],
    credits: Number(data["credits_consumed"]) || 0,
  };
}

/** One person from Apollo, ready to save, with their photo kept here. */
async function rowOf(sb: SupabaseClient, p: Json) {
  const org = (p["organization"] ?? {}) as Json;
  const history = Array.isArray(p["employment_history"]) ? (p["employment_history"] as Json[]) : [];
  const current = history.find((h) => h["current"] === true);
  const email = str(p["email"]);
  const place = [str(p["city"]), str(p["state"]), str(p["country"])].filter((x, i, all) => x !== "" && all.indexOf(x) === i);
  const phone = (org["primary_phone"] ?? {}) as Json;
  const size = Number(org["estimated_num_employees"]);
  const values: Json = {};
  const put = (key: string, v: string | number) => {
    if (typeof v === "number" ? Number.isFinite(v) && v > 0 : v.trim() !== "") values[key] = v;
  };
  put("title", str(p["title"]));
  put("company", str(org["name"]) || str(current?.["organization_name"]));
  // A locked address comes back as a stand-in; it isn't kept.
  if (email.includes("@") && !/^email_not_unlocked@/i.test(email)) put("email", email);
  put("location", place.join(", "));
  put("linkedin", str(p["linkedin_url"]));
  put("phone", str(phone["sanitized_number"]) || str(phone["number"]) || str(org["phone"]));
  put("industry", str(org["industry"]));
  put("size", Number.isFinite(size) ? Math.round(size) : 0);
  put("website", str(org["website_url"]) || str(org["primary_domain"]));
  const id = crypto.randomUUID();
  const photo_path = await keepPhoto(sb, id, str(p["photo_url"]));
  return {
    id,
    apollo_id: str(p["id"]),
    name: str(p["name"]) || [str(p["first_name"]), str(p["last_name"])].filter(Boolean).join(" ") || "No name",
    details: values,
    photo_path,
  };
}

/** Their photo, copied from where Apollo keeps it; none if it won't come. */
async function keepPhoto(sb: SupabaseClient, id: string, url: string): Promise<string | null> {
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > PHOTO_MOST_BYTES) return null;
    const path = `${id}/photo.${type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1]}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

/** How many people there are, for the count beside Art directors. */
export async function count(): Promise<number> {
  const { count: n } = await db().from("art_contacts").select("id", { count: "exact", head: true });
  return n ?? 0;
}
