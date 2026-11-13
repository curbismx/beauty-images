// A line to a mail server, as bytes in and out, whichever way it's made.
// Server only: load it with a dynamic import.
//
// On Lovable's hosting (Cloudflare Workers) the line is a cloudflare:sockets
// connection, which can be secure from the start (TLS) or start plain and
// switch to TLS (STARTTLS). Running under Node, the same is done with
// node:net and node:tls. A plain line with no TLS at all is only ever
// allowed to this machine, for tests.

export type Security = "starttls" | "tls" | "none";

export interface Address {
  host: string;
  port: number;
  security: Security;
}

export interface Wire {
  /** The next bytes from the server, or null once it has closed the line. */
  read(): Promise<Uint8Array | null>;
  write(text: string): Promise<void>;
  /** Switches a plain line to TLS, as STARTTLS asks. */
  startTls(): Promise<void>;
  close(): void;
}

export class WireError extends Error {}

const isLoopback = (host: string) => host === "127.0.0.1" || host === "localhost" || host === "::1";

/* ------------------------------------------------- Cloudflare Workers */

interface CfSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls(): CfSocket;
  close(): Promise<void>;
}

interface CfSockets {
  connect(
    address: { hostname: string; port: number },
    options?: { secureTransport?: "off" | "on" | "starttls"; allowHalfOpen?: boolean },
  ): CfSocket;
}

async function cloudflareSockets(): Promise<CfSockets | null> {
  try {
    // Left alone by the bundler; it only exists on Cloudflare.
    const name = "cloudflare:sockets";
    const mod = (await import(/* @vite-ignore */ name)) as CfSockets;
    return typeof mod.connect === "function" ? mod : null;
  } catch {
    return null;
  }
}

function cfWire(sockets: CfSockets, a: Address): Wire {
  const transport = a.security === "tls" ? "on" : a.security === "starttls" ? "starttls" : "off";
  let socket = sockets.connect({ hostname: a.host, port: a.port }, { secureTransport: transport, allowHalfOpen: false });
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  return {
    async read() {
      const { value, done } = await reader.read();
      return done ? null : (value ?? new Uint8Array());
    },
    write: (text) => writer.write(encoder.encode(text)),
    async startTls() {
      reader.releaseLock();
      writer.releaseLock();
      socket = socket.startTls();
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
    },
    close() {
      try {
        reader.releaseLock();
        writer.releaseLock();
        void socket.close();
      } catch {
        /* already gone */
      }
    },
  };
}

/* --------------------------------------------------------------- Node */

async function nodeWire(a: Address): Promise<Wire> {
  const net = await import("node:net");
  const tls = await import("node:tls");
  type Sock = import("node:net").Socket;

  const chunks: (Uint8Array | null)[] = [];
  let waiting: { ok: (c: Uint8Array | null) => void; fail: (e: Error) => void } | null = null;
  let gone: Error | null = null;

  const hand = (c: Uint8Array | null) => {
    if (waiting) {
      const w = waiting;
      waiting = null;
      w.ok(c);
    } else chunks.push(c);
  };
  const attach = (s: Sock) => {
    s.on("data", (chunk: Buffer) => hand(new Uint8Array(chunk)));
    s.on("error", (e: Error) => {
      gone = e;
      if (waiting) {
        const w = waiting;
        waiting = null;
        w.fail(e);
      }
    });
    s.on("close", () => hand(null));
  };

  const first: Sock = await new Promise((resolve, reject) => {
    const s =
      a.security === "tls"
        ? tls.connect({ host: a.host, port: a.port, servername: a.host }, () => resolve(s))
        : net.connect({ host: a.host, port: a.port }, () => resolve(s));
    s.once("error", reject);
  });
  let current = first;
  attach(current);

  return {
    read: () =>
      new Promise((ok, fail) => {
        if (chunks.length) return ok(chunks.shift() ?? null);
        if (gone) return fail(gone);
        waiting = { ok, fail };
      }),
    write: (text) =>
      new Promise((ok, fail) => {
        current.write(text, (e) => (e ? fail(e) : ok()));
      }),
    async startTls() {
      current.removeAllListeners("data");
      current.removeAllListeners("close");
      current.removeAllListeners("error");
      chunks.length = 0;
      const secure = await new Promise<Sock>((resolve, reject) => {
        const t = tls.connect({ socket: current, servername: a.host }, () => resolve(t));
        t.once("error", reject);
      });
      current = secure;
      attach(current);
    },
    close() {
      current.end();
      current.destroy();
    },
  };
}

/** Opens the line. */
export async function openWire(a: Address): Promise<Wire> {
  if (a.security === "none" && !isLoopback(a.host)) {
    throw new WireError("A plain line is only allowed to this machine.");
  }
  const cf = await cloudflareSockets();
  return cf ? cfWire(cf, a) : nodeWire(a);
}

/** A read that gives up after a while. */
export function within<T>(ms: number, p: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new WireError(`The mail server didn't answer (${what}).`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
