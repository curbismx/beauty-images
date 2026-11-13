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

interface Built {
  subject: string;
  html: string;
  text: string;
  unsubscribe: string;
}

/** The email for one person: subject and design filled in, the footer and the unsubscribe link underneath. */
async function build(row: Row, p: { id: string; name: string; details: Record<string, unknown> | null }): Promise<Built> {
  const unsubscribe = await unsubscribeUrl(row.secret, p.id);
  const subject = fill(row.subject, p, false);
  let html = fill(row.html, p, true);
  const footerHtml = `<p style="margin:28px 0 0;font:12px/1.6 -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#8e8e93">${
    row.footer ? `${escapeHtml(row.footer)}<br>` : ""
  }<a href="${unsubscribe}" style="color:#8e8e93">Unsubscribe</a></p>`;
  if (/\{\{\s*unsubscribe\s*\}\}/i.test(html)) html = html.replace(/\{\{\s*unsubscribe\s*\}\}/gi, unsubscribe);
  else if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${footerHtml}</body>`);
  else html += footerHtml;
  const text = `${textOf(fill(row.html, p, false))}\n\n${row.footer ? `${row.footer}\n` : ""}Unsubscribe: ${unsubscribe}`;
  return { subject, html, text, unsubscribe };
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
            await sb.from("art_sends").insert({ contact_id: p.id, to_email: to, subject: built.subject, status: "sent" });
            await sb.from("art_contacts").update({ queued_at: null, last_emailed_at: new Date().toISOString() }).eq("id", p.id);
            result.sent++;
          } catch (e) {
            const { SmtpError } = await import("./smtp.server");
            const err = e instanceof Error ? e : new Error(String(e));
            const stage = e instanceof SmtpError ? e.stage : "";
            await sb.from("art_sends").insert({ contact_id: p.id, to_email: to, subject: built.subject, status: "failed", note: err.message.slice(0, 300) });
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
