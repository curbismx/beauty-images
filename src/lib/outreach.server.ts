// The emails to the art directors: one email, written in the Curbism admin,
// sent a few an hour to the people in the queue as mail@beautyimages.net,
// with bounces read back from that mailbox. The mailbox's app-specific
// password lives in this project's secrets (OUTREACH_SMTP_USER and
// OUTREACH_SMTP_PASSWORD) and never leaves the server. Server only.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ArtError } from "./artDirectors.server";

type Json = Record<string, unknown>;

const SITE = "https://beautyimages.com";
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The hourly runs in a day (9 to 4): the daily limit is spread across them. */
const RUNS_A_DAY = 8;
/** A run that started this recently is still going; one this recent is enough for now. */
const RUNNING_MS = 10 * 60_000;
const REST_MS = 45 * 60_000;
const SUBJECT_MOST = 200;
const HTML_MOST = 200_000;

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 5000) : []);

/* ------------------------------------------------------------ settings */

export interface Settings {
  sending: boolean;
  daily_limit: number;
  subject: string;
  html: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  footer: string;
  test_to: string;
  last_run_at: string | null;
  last_note: string;
}

interface Row extends Settings {
  secret: string;
  mail_uid: number;
  running_at: string | null;
}

const SETTINGS_COLUMNS = "sending, daily_limit, subject, html, from_name, from_email, reply_to, footer, test_to, last_run_at, last_note";

async function readRow(sb: SupabaseClient): Promise<Row> {
  const { data, error } = await sb.from("art_outreach").select(`${SETTINGS_COLUMNS}, secret, mail_uid, running_at`).eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ArtError("The email settings aren't in the database yet.", 503);
  return data as unknown as Row;
}

const publicOf = (r: Row): Settings => {
  const { secret: _s, mail_uid: _u, running_at: _r, ...rest } = r;
  return rest;
};

export interface Status {
  queued: number;
  sent: number;
  sentToday: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
  ready: boolean;
}

type Counter = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

async function count(sb: SupabaseClient, table: string, where: (q: Counter) => Counter): Promise<number> {
  const { count: n, error } = await where(sb.from(table).select("id", { count: "exact", head: true }));
  if (error) throw new Error(error.message);
  return n ?? 0;
}

const dayStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

async function status(sb: SupabaseClient): Promise<Status> {
  const today = dayStart();
  const [queued, sent, sentToday, failed, bounced, unsubscribed] = await Promise.all([
    count(sb, "art_contacts", (q) => q.not("queued_at", "is", null)),
    count(sb, "art_sends", (q) => q.eq("status", "sent")),
    count(sb, "art_sends", (q) => q.eq("status", "sent").gte("sent_at", today)),
    count(sb, "art_sends", (q) => q.eq("status", "failed")),
    count(sb, "art_contacts", (q) => q.not("bounced_at", "is", null)),
    count(sb, "art_contacts", (q) => q.not("unsubscribed_at", "is", null)),
  ]);
  const ready = !!(process.env["OUTREACH_SMTP_USER"] && process.env["OUTREACH_SMTP_PASSWORD"]);
  return { queued, sent, sentToday, failed, bounced, unsubscribed, ready };
}

/** The email and where things stand, for the admin's Emails page. */
export async function settings(): Promise<{ settings: Settings; status: Status }> {
  const sb = db();
  const row = await readRow(sb);
  return { settings: publicOf(row), status: await status(sb) };
}

export async function saveSettings(body: Json): Promise<{ settings: Settings; status: Status }> {
  const s = (body["settings"] ?? {}) as Json;
  const patch: Partial<Settings> & { updated_at: string } = { updated_at: new Date().toISOString() };
  if (typeof s["sending"] === "boolean") patch.sending = s["sending"];
  if (s["daily_limit"] !== undefined) {
    const n = Math.round(Number(s["daily_limit"]));
    if (!Number.isFinite(n) || n < 1 || n > 200) throw new ArtError("The daily limit needs to be between 1 and 200.");
    patch.daily_limit = n;
  }
  if (s["subject"] !== undefined) patch.subject = str(s["subject"]).slice(0, SUBJECT_MOST);
  if (s["html"] !== undefined) {
    const html = typeof s["html"] === "string" ? s["html"] : "";
    if (html.length > HTML_MOST) throw new ArtError("The email's HTML is too long.");
    patch.html = html;
  }
  if (s["from_name"] !== undefined) patch.from_name = str(s["from_name"]).slice(0, 80);
  if (s["from_email"] !== undefined) {
    const e = str(s["from_email"]).toLowerCase();
    if (!EMAIL.test(e)) throw new ArtError("The From address isn't an email address.");
    patch.from_email = e;
  }
  if (s["reply_to"] !== undefined) {
    const e = str(s["reply_to"]).toLowerCase();
    if (e && !EMAIL.test(e)) throw new ArtError("The Reply-to address isn't an email address.");
    patch.reply_to = e;
  }
  if (s["footer"] !== undefined) patch.footer = str(s["footer"]).slice(0, 500);
  if (s["test_to"] !== undefined) {
    const e = str(s["test_to"]).toLowerCase();
    if (e && !EMAIL.test(e)) throw new ArtError("The test address isn't an email address.");
    patch.test_to = e;
  }
  const sb = db();
  const { error } = await sb.from("art_outreach").update(patch).eq("id", 1);
  if (error) throw new Error(error.message);
  return settings();
}

/* ---------------------------------------------------------- the designs */

export interface Design {
  id: string;
  name: string;
  html: string;
  created_at: string;
}

const DESIGNS_MOST = 30;
const NAME_MOST = 80;

/** The saved designs, newest first. */
export async function designs(): Promise<{ designs: Design[] }> {
  const { data, error } = await db().from("art_designs").select("id, name, html, created_at").order("created_at", { ascending: false }).limit(DESIGNS_MOST);
  if (error) throw new Error(error.message);
  return { designs: (data ?? []) as Design[] };
}

/** Keeps an uploaded design under its file name; the same name again replaces it. */
export async function saveDesign(body: Json): Promise<{ designs: Design[]; id: string }> {
  const name = str(body["name"]).replace(/\.html?$/i, "").slice(0, NAME_MOST);
  const html = typeof body["html"] === "string" ? body["html"] : "";
  if (!name) throw new ArtError("The design needs a name.");
  if (!html.trim()) throw new ArtError("That file is empty.");
  if (html.length > HTML_MOST) throw new ArtError("The design's HTML is too long.");
  const sb = db();
  const { data: had, error: findError } = await sb.from("art_designs").select("id").ilike("name", name).maybeSingle();
  if (findError) throw new Error(findError.message);
  let id: string;
  if (had) {
    const { error } = await sb.from("art_designs").update({ html, name, created_at: new Date().toISOString() }).eq("id", had.id);
    if (error) throw new Error(error.message);
    id = had.id as string;
  } else {
    const { count: n, error: countError } = await sb.from("art_designs").select("id", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);
    if ((n ?? 0) >= DESIGNS_MOST) throw new ArtError(`That's ${DESIGNS_MOST} designs already. Delete one first.`);
    const { data, error } = await sb.from("art_designs").insert({ name, html }).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id as string;
  }
  return { ...(await designs()), id };
}

export async function deleteDesign(body: Json): Promise<{ designs: Design[] }> {
  const id = str(body["id"]);
  if (!UUID.test(id)) throw new ArtError("Which design?");
  const { error } = await db().from("art_designs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return designs();
}

/* ------------------------------------------------------------ the queue */

interface Person {
  id: string;
  name: string;
  details: Record<string, unknown> | null;
  queued_at: string | null;
  last_emailed_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
}

const emailOf = (p: Person) => {
  const e = str(p.details?.["email"]).toLowerCase();
  return EMAIL.test(e) ? e : "";
};

/** Who can be queued: someone with an email, not yet emailed, who hasn't bounced or said no. */
const canQueue = (p: Person) => !!emailOf(p) && !p.last_emailed_at && !p.bounced_at && !p.unsubscribed_at && !p.queued_at;

async function people(sb: SupabaseClient, only?: string[]): Promise<Person[]> {
  const cols = "id, name, details, queued_at, last_emailed_at, unsubscribed_at, bounced_at";
  const out: Person[] = [];
  if (only) {
    for (let i = 0; i < only.length; i += 200) {
      const { data, error } = await sb.from("art_contacts").select(cols).in("id", only.slice(i, i + 200));
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as Person[]));
    }
    return out;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("art_contacts").select(cols).order("created_at", { ascending: true }).range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Person[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/** Puts people in the queue: the ones given, or everyone who can be. Says how many went in and why the rest didn't. */
export async function queue(body: Json): Promise<{ queued: number; skipped: { noEmail: number; done: number; bounced: number; no: number; already: number } }> {
  const sb = db();
  const list = body["all"] === true ? await people(sb) : await people(sb, ids(body["ids"]));
  const skipped = { noEmail: 0, done: 0, bounced: 0, no: 0, already: 0 };
  const go: string[] = [];
  for (const p of list) {
    if (!emailOf(p)) skipped.noEmail++;
    else if (p.unsubscribed_at) skipped.no++;
    else if (p.bounced_at) skipped.bounced++;
    else if (p.last_emailed_at) skipped.done++;
    else if (p.queued_at) skipped.already++;
    else go.push(p.id);
  }
  const now = new Date().toISOString();
  for (let i = 0; i < go.length; i += 200) {
    const { error } = await sb.from("art_contacts").update({ queued_at: now }).in("id", go.slice(i, i + 200)).is("queued_at", null);
    if (error) throw new Error(error.message);
  }
  return { queued: go.length, skipped };
}

/** Takes people out of the queue: the ones given, or everyone. */
export async function unqueue(body: Json): Promise<{ removed: number }> {
  const sb = db();
  if (body["all"] === true) {
    const { data, error } = await sb.from("art_contacts").update({ queued_at: null }).not("queued_at", "is", null).select("id");
    if (error) throw new Error(error.message);
    return { removed: (data ?? []).length };
  }
  const list = ids(body["ids"]);
  let removed = 0;
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await sb.from("art_contacts").update({ queued_at: null }).in("id", list.slice(i, i + 200)).not("queued_at", "is", null).select("id");
    if (error) throw new Error(error.message);
    removed += (data ?? []).length;
  }
  return { removed };
}

/* ------------------------------------------------------------ the email itself */

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** [first name], [name], [company] and [job title] filled in for one person, as Nuron fills them. */
function fill(template: string, p: { name: string; details: Record<string, unknown> | null }, html: boolean): string {
  const name = p.name.trim();
  const words: Record<string, string> = {
    "first name": name.split(/\s+/)[0] ?? "",
    name,
    company: str(p.details?.["company"]),
    "job title": str(p.details?.["title"]),
  };
  return template.replace(/\[\s*(first name|name|company|job title)\s*\]/gi, (_, key: string) => {
    const w = words[key.toLowerCase().replace(/\s+/g, " ")] ?? "";
    return html ? escapeHtml(w) : w;
  });
}

/** The design's words, for the plain reading of the email. */
function textOf(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => `${inner.replace(/<[^>]+>/g, "")} (${href})`)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sign(secret: string, id: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsubscribe:${id}`));
  return Array.from(new Uint8Array(sig).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

const unsubscribeUrl = async (secret: string, id: string) => `${SITE}/api/public/unsubscribe?c=${id}&t=${await sign(secret, id)}`;

/** The link that logs a click against one email, then sends the reader on. */
const clickUrl = async (secret: string, key: string, url: string) =>
  `${SITE}/api/public/c?k=${key}&u=${encodeURIComponent(url)}&t=${await sign(secret, `click:${key}:${url}`)}`;

/** The invisible picture that logs an open. */
const openPixel = async (secret: string, key: string) =>
  `<img src="${SITE}/api/public/o?k=${key}&amp;t=${await sign(secret, `open:${key}`)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;">`;

/** Every web link in the design goes through the click log. Mail links and the unsubscribe link are left alone. */
async function trackLinks(secret: string, key: string, html: string): Promise<string> {
  const links = [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)];
  const seen = new Map<string, string>();
  for (const m of links) {
    const url = m[1]!.replace(/&amp;/g, "&");
    if (!seen.has(url)) seen.set(url, await clickUrl(secret, key, url));
  }
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (whole, raw: string) => {
    const tracked = seen.get(raw.replace(/&amp;/g, "&"));
    return tracked ? `href="${escapeHtml(tracked)}"` : whole;
  });
}

interface Built {
  subject: string;
  html: string;
  text: string;
  unsubscribe: string;
  key: string;
}

/** The email for one person: subject and design filled in, links and an open pixel tracked, the footer and the unsubscribe link underneath. */
async function build(row: Row, p: { id: string; name: string; details: Record<string, unknown> | null }): Promise<Built> {
  const key = crypto.randomUUID();
  const unsubscribe = await unsubscribeUrl(row.secret, p.id);
  const subject = fill(row.subject, p, false);
  let html = await trackLinks(row.secret, key, fill(row.html, p, true));
  const pixel = await openPixel(row.secret, key);
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${pixel}</body>`);
  else html += pixel;
  const footerHtml = `<p style="margin:28px 0 0;font:12px/1.6 -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#8e8e93">${
    row.footer ? `${escapeHtml(row.footer)}<br>` : ""
  }<a href="${unsubscribe}" style="color:#8e8e93">Unsubscribe</a></p>`;
  if (/\{\{\s*unsubscribe\s*\}\}/i.test(html)) html = html.replace(/\{\{\s*unsubscribe\s*\}\}/gi, unsubscribe);
  else if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${footerHtml}</body>`);
  else html += footerHtml;
  const text = `${textOf(fill(row.html, p, false))}\n\n${row.footer ? `${row.footer}\n` : ""}Unsubscribe: ${unsubscribe}`;
  return { subject, html, text, unsubscribe, key };
}

/** Sends one email, or throws. */
async function deliver(row: Row, to: string, built: Built): Promise<void> {
  const { sendMail, serverFromEnv } = await import("./smtp.server");
  await sendMail(serverFromEnv(), {
    from: { name: row.from_name, address: row.from_email },
    to,
    replyTo: row.reply_to || undefined,
    subject: built.subject,
    html: built.html,
    text: built.text,
    unsubscribe: built.unsubscribe,
  });
}

/** A test email to the admin's own address, as the first person in the queue would get it. */
export async function sendTest(body: Json): Promise<{ sent: string }> {
  const to = str(body["to"]).toLowerCase();
  if (!EMAIL.test(to)) throw new ArtError("That isn't an email address.");
  const sb = db();
  const row = await readRow(sb);
  if (!row.subject.trim() || !row.html.trim()) throw new ArtError("Write the subject and the email first.");
  const { data } = await sb.from("art_contacts").select("id, name, details").not("queued_at", "is", null).order("queued_at", { ascending: true }).limit(1);
  const sample = (data?.[0] as { id: string; name: string; details: Record<string, unknown> | null } | undefined) ?? {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Alex Example",
    details: { company: "Example Magazine", title: "Picture Editor" },
  };
  const built = await build(row, sample);
  try {
    await deliver(row, to, built);
  } catch (e) {
    throw new ArtError(`The test didn't send. ${e instanceof Error ? e.message : String(e)}`, 502);
  }
  await sb.from("art_outreach").update({ test_to: to }).eq("id", 1);
  return { sent: to };
}

/* ------------------------------------------------------------ the hourly run */

export interface RunResult {
  sent: number;
  failed: number;
  bounced: number;
  note: string;
}

/**
 * One run: the next few from the queue (the daily limit spread over the
 * day's runs, never past the limit), then a look in the mailbox for
 * bounces. Safe to call at any time: a run that is too soon after the last,
 * or while one is going, does nothing.
 */
export async function run(force = false): Promise<RunResult> {
  const sb = db();
  const row = await readRow(sb);
  const now = Date.now();
  if (row.running_at && now - Date.parse(row.running_at) < RUNNING_MS) return { sent: 0, failed: 0, bounced: 0, note: "Already running" };
  if (!force && row.last_run_at && now - Date.parse(row.last_run_at) < REST_MS) return { sent: 0, failed: 0, bounced: 0, note: "Ran a moment ago" };
  await sb.from("art_outreach").update({ running_at: new Date(now).toISOString() }).eq("id", 1);

  const result: RunResult = { sent: 0, failed: 0, bounced: 0, note: "" };
  const notes: string[] = [];
  try {
    if (row.sending && row.subject.trim() && row.html.trim()) {
      const sentToday = await count(sb, "art_sends", (q) => q.eq("status", "sent").gte("sent_at", dayStart()));
      const perRun = Math.ceil(row.daily_limit / RUNS_A_DAY);
      const room = Math.max(0, Math.min(perRun, row.daily_limit - sentToday));
      if (room > 0) {
        const { data, error } = await sb
          .from("art_contacts")
          .select("id, name, details, queued_at, last_emailed_at, unsubscribed_at, bounced_at")
          .not("queued_at", "is", null)
          .order("queued_at", { ascending: true })
          .limit(room * 2);
        if (error) throw new Error(error.message);
        const due = ((data ?? []) as Person[]).filter((p) => emailOf(p) && !p.unsubscribed_at && !p.bounced_at).slice(0, room);
        for (const p of due) {
          const to = emailOf(p);
          const built = await build(row, p);
          try {
            await deliver(row, to, built);
            await sb.from("art_sends").insert({ contact_id: p.id, to_email: to, subject: built.subject, status: "sent", key: built.key });
            await sb.from("art_contacts").update({ queued_at: null, last_emailed_at: new Date().toISOString() }).eq("id", p.id);
            result.sent++;
          } catch (e) {
            const { SmtpError } = await import("./smtp.server");
            const err = e instanceof Error ? e : new Error(String(e));
            const stage = e instanceof SmtpError ? e.stage : "";
            await sb.from("art_sends").insert({ contact_id: p.id, to_email: to, subject: built.subject, status: "failed", note: err.message.slice(0, 300), key: built.key });
            result.failed++;
            if (stage === "to") {
              // Their address was refused: it has come back before it went.
              await sb.from("art_contacts").update({ queued_at: null, bounced_at: new Date().toISOString(), bounce_note: err.message.slice(0, 300) }).eq("id", p.id);
              result.bounced++;
            } else {
              // Our side: the sign-in, the line or the server. Stop here and try again next hour.
              notes.push(`Sending stopped: ${err.message}`);
              break;
            }
          }
        }
      } else if (sentToday >= row.daily_limit) notes.push("Today's limit reached");
    } else if (!row.sending) notes.push("Sending is off");
    else notes.push("The email isn't written yet");

    try {
      const b = await checkBounces(sb, row);
      result.bounced += b.bounced;
      if (b.read) notes.push(`${b.read} new in the mailbox, ${b.bounced} bounced`);
    } catch (e) {
      notes.push(`Mailbox check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } finally {
    result.note = notes.join(". ") || `Sent ${result.sent}`;
    await sb
      .from("art_outreach")
      .update({ running_at: null, last_run_at: new Date().toISOString(), last_note: result.note.slice(0, 300) })
      .eq("id", 1);
  }
  return result;
}

/* ------------------------------------------------------------ bounces */

const BOUNCE_SUBJECT = /undeliver|delivery (status|failure|has failed)|failure notice|returned mail|could not be delivered|not delivered|delivery problem|mail delivery failed|rejected/i;
const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery|delivery subsystem/i;

/** The addresses a bounce report says it couldn't deliver to. */
export function failedAddresses(body: string): string[] {
  const text = body.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:Final|Original)-Recipient:\s*(?:rfc822|x-original-rfc822)?;?\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) {
    found.add((m[1] ?? "").toLowerCase());
  }
  if (found.size === 0) {
    for (const m of text.matchAll(/<?([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})>?/gi)) found.add((m[1] ?? "").toLowerCase());
  }
  return [...found];
}

/** The reason, in a line, from a bounce report. */
function reasonOf(body: string): string {
  const text = body.replace(/=\r?\n/g, "");
  const diag = /Diagnostic-Code:\s*(?:smtp;)?\s*(.+)/i.exec(text)?.[1];
  const said = diag ?? /\b5\d\d[ -][\d.]+\s+(.+)/.exec(text)?.[1] ?? "";
  return said.trim().slice(0, 200);
}

async function checkBounces(sb: SupabaseClient, row: Row): Promise<{ read: number; bounced: number }> {
  const { newMessages, mailboxFromEnv } = await import("./imap.server");
  const box = mailboxFromEnv();
  if (!box.user || !box.password) return { read: 0, bounced: 0 };
  const { messages, lastUid } = await newMessages(box, row.mail_uid);
  let bounced = 0;
  for (const m of messages) {
    if (!BOUNCE_SUBJECT.test(m.subject) && !BOUNCE_FROM.test(m.from)) continue;
    const addresses = failedAddresses(m.body).filter((a) => !a.endsWith("@beautyimages.net") && !a.endsWith("@icloud.com"));
    if (addresses.length === 0) continue;
    const { data, error } = await sb
      .from("art_contacts")
      .select("id, details")
      .not("last_emailed_at", "is", null)
      .is("bounced_at", null)
      .limit(2000);
    if (error) throw new Error(error.message);
    const hit = ((data ?? []) as { id: string; details: Record<string, unknown> | null }[]).filter((c) =>
      addresses.includes(str(c.details?.["email"]).toLowerCase()),
    );
    const reason = reasonOf(m.body) || m.subject;
    for (const c of hit) {
      await sb.from("art_contacts").update({ bounced_at: new Date().toISOString(), bounce_note: reason, queued_at: null }).eq("id", c.id);
      await sb.from("art_sends").insert({ contact_id: c.id, to_email: str(c.details?.["email"]).toLowerCase(), status: "bounced", note: reason });
      bounced++;
    }
  }
  if (lastUid !== row.mail_uid) await sb.from("art_outreach").update({ mail_uid: lastUid }).eq("id", 1);
  return { read: messages.length, bounced };
}

/* ------------------------------------------------------------ unsubscribe */

/* --------------------------------------------------------- opens and clicks */

/** An email's open pixel loaded: logged when the key and token are real, silently otherwise. */
export async function opened(key: string, token: string): Promise<void> {
  if (!UUID.test(key)) return;
  const sb = db();
  const row = await readRow(sb);
  if (token !== (await sign(row.secret, `open:${key}`))) return;
  const { data } = await sb.from("art_sends").select("id, opens, opened_at").eq("key", key).maybeSingle();
  if (!data) return;
  await sb
    .from("art_sends")
    .update({ opens: ((data.opens as number) ?? 0) + 1, opened_at: (data.opened_at as string | null) ?? new Date().toISOString() })
    .eq("id", data.id);
}

/** A tracked link clicked: the real address to send the reader on to, or null when the link isn't ours. */
export async function clicked(key: string, url: string, token: string): Promise<string | null> {
  if (!UUID.test(key) || !/^https?:\/\//i.test(url) || url.length > 2000) return null;
  const sb = db();
  const row = await readRow(sb);
  if (token !== (await sign(row.secret, `click:${key}:${url}`))) return null;
  const { data } = await sb.from("art_sends").select("id, clicks, clicked_at, opened_at").eq("key", key).maybeSingle();
  if (data) {
    const now = new Date().toISOString();
    await sb
      .from("art_sends")
      .update({
        clicks: ((data.clicks as number) ?? 0) + 1,
        clicked_at: (data.clicked_at as string | null) ?? now,
        last_url: url.slice(0, 500),
        // A click is an open too, whether or not the pictures loaded.
        opened_at: (data.opened_at as string | null) ?? now,
      })
      .eq("id", data.id);
  }
  return url;
}

/* ------------------------------------------------------------ the sends list */

export interface SendRow {
  id: number;
  contact_id: string;
  name: string;
  company: string;
  to_email: string;
  subject: string;
  status: string;
  note: string;
  sent_at: string;
  opened_at: string | null;
  opens: number;
  clicked_at: string | null;
  clicks: number;
  last_url: string;
  unsubscribed_at: string | null;
}

export interface SendTotals {
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  unsubscribed: number;
}

const SENDS_MOST = 2000;

/** Every email that went out, newest first, with its opens and clicks, for the admin's Emails page. */
export async function sends(): Promise<{ sends: SendRow[]; totals: SendTotals }> {
  const sb = db();
  const { data, error } = await sb
    .from("art_sends")
    .select("id, contact_id, to_email, subject, status, note, sent_at, opened_at, opens, clicked_at, clicks, last_url, art_contacts ( name, details, unsubscribed_at )")
    .neq("status", "test")
    .order("sent_at", { ascending: false })
    .limit(SENDS_MOST);
  if (error) throw new Error(error.message);
  type Raw = {
    id: number;
    contact_id: string;
    to_email: string;
    subject: string;
    status: string;
    note: string;
    sent_at: string;
    opened_at: string | null;
    opens: number;
    clicked_at: string | null;
    clicks: number;
    last_url: string;
    art_contacts: { name: string; details: Record<string, unknown> | null; unsubscribed_at: string | null } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r): SendRow => ({
    id: r.id,
    contact_id: r.contact_id,
    name: r.art_contacts?.name ?? "",
    company: str(r.art_contacts?.details?.["company"]),
    to_email: r.to_email,
    subject: r.subject,
    status: r.status,
    note: r.note,
    sent_at: r.sent_at,
    opened_at: r.opened_at,
    opens: r.opens ?? 0,
    clicked_at: r.clicked_at,
    clicks: r.clicks ?? 0,
    last_url: r.last_url ?? "",
    unsubscribed_at: r.art_contacts?.unsubscribed_at ?? null,
  }));
  const sent = rows.filter((r) => r.status === "sent");
  const totals: SendTotals = {
    sent: sent.length,
    opened: sent.filter((r) => r.opened_at).length,
    clicked: sent.filter((r) => r.clicked_at).length,
    failed: rows.filter((r) => r.status === "failed").length,
    bounced: rows.filter((r) => r.status === "bounced").length,
    unsubscribed: new Set(sent.filter((r) => r.unsubscribed_at).map((r) => r.contact_id)).size,
  };
  return { sends: rows, totals };
}

/** The link under every email: the person asked for no more. */
export async function unsubscribe(contactId: string, token: string): Promise<boolean> {
  if (!UUID.test(contactId) || !/^[0-9a-f]{32}$/.test(token)) return false;
  const sb = db();
  const row = await readRow(sb);
  if ((await sign(row.secret, contactId)) !== token) return false;
  const { data, error } = await sb
    .from("art_contacts")
    .update({ unsubscribed_at: new Date().toISOString(), queued_at: null })
    .eq("id", contactId)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
