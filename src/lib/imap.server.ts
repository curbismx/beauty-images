// Reading a mailbox the way a mail app does (IMAP), only as far as the
// outreach needs: the new messages since last time, each with who it's
// from, its subject and the start of its words, so bounces can be spotted.
// Nothing is changed or marked as read. Server only: load it with a dynamic
// import.

import { Buffer } from "node:buffer";
import { openWire, within, type Address, type Wire } from "./wire.server";

export interface Mailbox extends Address {
  user: string;
  password: string;
}

export interface Message {
  uid: number;
  from: string;
  subject: string;
  /** The first part of the message's words, as sent. */
  body: string;
}

export class ImapError extends Error {}

const REPLY_MS = 25_000;
/** How much of each message is read: enough for any bounce report. */
const BODY_BYTES = 24_000;

interface Line {
  text: string;
  literals: string[];
}

/** Talks to the server one command at a time, reading its replies, literals and all. */
class Talk {
  private bytes = new Uint8Array();
  private n = 0;
  constructor(private wire: Wire) {}

  private async fill(): Promise<void> {
    const chunk = await within(REPLY_MS, this.wire.read(), "reading");
    if (chunk === null) throw new ImapError("The mailbox closed the line.");
    const next = new Uint8Array(this.bytes.length + chunk.length);
    next.set(this.bytes);
    next.set(chunk, this.bytes.length);
    this.bytes = next;
  }

  private indexOfCrlf(): number {
    for (let i = 0; i + 1 < this.bytes.length; i++) {
      if (this.bytes[i] === 13 && this.bytes[i + 1] === 10) return i;
    }
    return -1;
  }

  /** One logical line: text, with any {N} literals read in full and kept aside. */
  private async line(): Promise<Line> {
    let text = "";
    const literals: string[] = [];
    for (;;) {
      let at = this.indexOfCrlf();
      while (at === -1) {
        await this.fill();
        at = this.indexOfCrlf();
      }
      const part = Buffer.from(this.bytes.subarray(0, at)).toString("latin1");
      this.bytes = this.bytes.subarray(at + 2);
      text += part;
      const lit = /\{(\d+)\}$/.exec(part);
      if (!lit) return { text, literals };
      const size = Number(lit[1]);
      while (this.bytes.length < size) await this.fill();
      literals.push(Buffer.from(this.bytes.subarray(0, size)).toString("utf8"));
      this.bytes = this.bytes.subarray(size);
      text += `<literal ${literals.length - 1}>`;
    }
  }

  async greeting(): Promise<void> {
    const l = await this.line();
    if (!/^\* (OK|PREAUTH)/i.test(l.text)) throw new ImapError(`Odd greeting from the mailbox: ${l.text.slice(0, 80)}`);
  }

  async command(tag: string, cmd: string): Promise<Line[]> {
    await within(REPLY_MS, this.wire.write(`${tag} ${cmd}\r\n`), "writing");
    const out: Line[] = [];
    for (;;) {
      const l = await this.line();
      if (l.text.startsWith(`${tag} `)) {
        if (!/^\S+ OK/i.test(l.text)) {
          const said = l.text.replace(/^\S+ (NO|BAD) ?/i, "");
          throw new ImapError(said || "The mailbox said no.");
        }
        return out;
      }
      out.push(l);
    }
  }
}

const quote = (s: string) => `"${s.replace(/[\\"]/g, (c) => `\\${c}`)}"`;

/** An encoded header word (=?UTF-8?B?...?=) read back. */
export function decodeHeader(s: string): string {
  return s
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, _cs: string, enc: string, data: string) => {
      try {
        if (enc.toLowerCase() === "b") return Buffer.from(data, "base64").toString("utf8");
        const qp = data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
        return Buffer.from(qp, "latin1").toString("utf8");
      } catch {
        return data;
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function headerOf(raw: string, name: string): string {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  const m = new RegExp(`^${name}:[ \\t]*(.*)$`, "im").exec(unfolded);
  return m ? decodeHeader(m[1] ?? "") : "";
}

const imapDate = (d: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

/**
 * The messages that arrived after the given UID (all of the last two weeks
 * when there is none), oldest first, up to `most` of them.
 */
export async function newMessages(box: Mailbox, afterUid: number, most = 60): Promise<{ messages: Message[]; lastUid: number }> {
  if (!box.user || !box.password) throw new ImapError("The mailbox isn't set up yet.");
  const wire = await openWire(box);
  const talk = new Talk(wire);
  let tagN = 0;
  const tag = () => `A${++tagN}`;
  try {
    await talk.greeting();
    await talk.command(tag(), `LOGIN ${quote(box.user)} ${quote(box.password)}`);
    await talk.command(tag(), "SELECT INBOX");
    const since = new Date(Date.now() - 14 * 86_400_000);
    const found = await talk.command(tag(), afterUid > 0 ? `UID SEARCH UID ${afterUid + 1}:*` : `UID SEARCH SINCE ${imapDate(since)}`);
    const uids = found
      .filter((l) => /^\* SEARCH/i.test(l.text))
      .flatMap((l) => l.text.replace(/^\* SEARCH ?/i, "").split(/\s+/).map(Number))
      .filter((u) => Number.isFinite(u) && u > afterUid)
      .sort((a, b) => a - b)
      .slice(0, most);

    const messages: Message[] = [];
    for (const uid of uids) {
      const lines = await talk.command(tag(), `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)] BODY.PEEK[TEXT]<0.${BODY_BYTES}>)`);
      const fetched = lines.find((l) => /^\* \d+ FETCH/i.test(l.text));
      if (!fetched) continue;
      const [head = "", text = ""] = fetched.literals;
      messages.push({ uid, from: headerOf(head, "From"), subject: headerOf(head, "Subject"), body: text });
    }
    try {
      await talk.command(tag(), "LOGOUT");
    } catch {
      /* done anyway */
    }
    return { messages, lastUid: uids.length ? Math.max(afterUid, ...uids) : afterUid };
  } finally {
    wire.close();
  }
}

/** The mailbox's details from the project's secrets: the same sign-in as sending. */
export function mailboxFromEnv(): Mailbox {
  return {
    host: process.env["OUTREACH_IMAP_HOST"] || "imap.mail.me.com",
    port: Number(process.env["OUTREACH_IMAP_PORT"]) || 993,
    security: (process.env["OUTREACH_IMAP_SECURITY"] ?? "tls").toLowerCase() === "none" ? "none" : "tls",
    user: (process.env["OUTREACH_SMTP_USER"] ?? "").trim(),
    password: (process.env["OUTREACH_SMTP_PASSWORD"] ?? "").trim(),
  };
}
