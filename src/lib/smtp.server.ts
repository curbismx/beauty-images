// Sending one email through a mailbox's own mail server (Apple's, for
// mail@beautyimages.net), the way a mail app does: connect, say hello,
// switch to a secure line, sign in with the app-specific password, hand
// over the message. Server only: load it with a dynamic import.

import { Buffer } from "node:buffer";
import { openWire, within, type Address, type Wire } from "./wire.server";

export interface Server extends Address {
  user: string;
  password: string;
}

export interface Mail {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** A link the recipient's mail app can offer as a one-click unsubscribe. */
  unsubscribe?: string;
}

export class SmtpError extends Error {
  constructor(
    message: string,
    /** Where it went wrong, for the admin's message. */
    public stage: string,
    public code: number | null = null,
  ) {
    super(message);
  }
}

/** How long one reply may take before the line is given up. */
const REPLY_MS = 25_000;
const SITE_HOST = "beautyimages.com";
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

interface Reply {
  code: number;
  text: string;
}

/** A full reply has arrived when its last line reads "250 text" rather than "250-text". */
function takeReply(buffer: string): { reply: Reply; rest: string } | null {
  const lines = buffer.split("\r\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i] ?? "";
    if (/^\d{3}(?: |$)/.test(line)) {
      const done = lines.slice(0, i + 1);
      const rest = lines.slice(i + 1).join("\r\n");
      return { reply: { code: Number(line.slice(0, 3)), text: done.map((l) => l.slice(4)).join("\n") }, rest };
    }
    if (!/^\d{3}-/.test(line)) throw new SmtpError(`Odd reply from the mail server: ${line.slice(0, 80)}`, "reply");
  }
  return null;
}

class Talk {
  private buffer = "";
  private decoder = new TextDecoder();
  constructor(private wire: Wire) {}

  async reply(): Promise<Reply> {
    for (;;) {
      const got = takeReply(this.buffer);
      if (got) {
        this.buffer = got.rest;
        return got.reply;
      }
      const chunk = await within(REPLY_MS, this.wire.read(), "reading");
      if (chunk === null) throw new SmtpError("The mail server closed the line.", "closed");
      this.buffer += this.decoder.decode(chunk, { stream: true });
    }
  }

  async expect(codes: number[], stage: string, send?: string): Promise<Reply> {
    if (send !== undefined) await within(REPLY_MS, this.wire.write(send + "\r\n"), "writing");
    const reply = await this.reply();
    if (!codes.includes(reply.code)) {
      const first = reply.text.split("\n")[0] ?? "";
      throw new SmtpError(`${stage}: the mail server said ${reply.code} ${first}`.trim(), stage, reply.code);
    }
    return reply;
  }

  async startTls() {
    await this.wire.startTls();
    this.buffer = "";
  }
}

const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const base64Lines = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

/** The message, ready for the line: headers, then the words and the design as two readings of one email. */
export function buildMessage(mail: Mail, messageId: string): string {
  const boundary = `=_bi_${messageId.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
  const fromName = mail.from.name ? `${encodeHeader(mail.from.name)} ` : "";
  const headers = [
    `From: ${fromName}<${mail.from.address}>`,
    `To: <${mail.to}>`,
    mail.replyTo ? `Reply-To: <${mail.replyTo}>` : null,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@${SITE_HOST}>`,
    mail.unsubscribe ? `List-Unsubscribe: <${mail.unsubscribe}>` : null,
    mail.unsubscribe ? "List-Unsubscribe-Post: List-Unsubscribe=One-Click" : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((h): h is string => h !== null);
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(mail.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(mail.html),
    `--${boundary}--`,
  ];
  return [...headers, "", ...body].join("\r\n");
}

/** Sends one email, or throws an SmtpError saying where it went wrong. */
export async function sendMail(server: Server, mail: Mail): Promise<{ messageId: string }> {
  if (!EMAIL.test(mail.to)) throw new SmtpError("That isn't an email address.", "address");
  if (!server.user || !server.password) throw new SmtpError("The mailbox isn't set up yet.", "setup");
  const messageId = `${Date.now().toString(36)}.${crypto.randomUUID()}`;
  // A line of the message that starts with a dot gets a second one, so it can't be taken as the end.
  const message = buildMessage(mail, messageId).replace(/\r\n\./g, "\r\n..");

  let wire: Wire;
  try {
    wire = await openWire(server);
  } catch (e) {
    throw new SmtpError(`Couldn't reach ${server.host}: ${e instanceof Error ? e.message : String(e)}`, "connect");
  }
  const talk = new Talk(wire);
  try {
    await talk.expect([220], "greeting");
    await talk.expect([250], "hello", `EHLO ${SITE_HOST}`);
    if (server.security === "starttls") {
      await talk.expect([220], "starttls", "STARTTLS");
      await talk.startTls();
      await talk.expect([250], "hello again", `EHLO ${SITE_HOST}`);
    }
    const plain = Buffer.from(`\0${server.user}\0${server.password}`, "utf8").toString("base64");
    await talk.expect([235], "sign in", `AUTH PLAIN ${plain}`);
    await talk.expect([250], "from", `MAIL FROM:<${mail.from.address}>`);
    await talk.expect([250, 251], "to", `RCPT TO:<${mail.to}>`);
    await talk.expect([354], "data", "DATA");
    await talk.expect([250], "message", message + "\r\n.");
    try {
      await talk.expect([221], "quit", "QUIT");
    } catch {
      /* sent; the goodbye doesn't matter */
    }
    return { messageId };
  } finally {
    wire.close();
  }
}

/** The mailbox's details from the project's secrets. */
export function serverFromEnv(): Server {
  const security = (process.env["OUTREACH_SMTP_SECURITY"] ?? "starttls").toLowerCase();
  const sec = security === "tls" ? "tls" : security === "none" ? "none" : "starttls";
  return {
    host: process.env["OUTREACH_SMTP_HOST"] || "smtp.mail.me.com",
    port: Number(process.env["OUTREACH_SMTP_PORT"]) || (sec === "tls" ? 465 : 587),
    security: sec,
    user: (process.env["OUTREACH_SMTP_USER"] ?? "").trim(),
    password: (process.env["OUTREACH_SMTP_PASSWORD"] ?? "").trim(),
  };
}
