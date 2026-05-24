import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: UnsubscribePage,
});

type Status = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
          return;
        }
        if (data.valid) setStatus("ready");
        else setStatus("invalid");
      } catch {
        setStatus("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success || data.reason === "already_unsubscribed") setStatus("done");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={h1}>BEAUTYIMAGES</h1>
        <h2 style={h2}>Unsubscribe</h2>
        {status === "loading" && <p style={text}>Checking your link…</p>}
        {status === "invalid" && (
          <p style={text}>This unsubscribe link is invalid or has expired.</p>
        )}
        {status === "already" && (
          <p style={text}>You have already been unsubscribed from this list.</p>
        )}
        {status === "error" && (
          <p style={text}>Something went wrong. Please try again later.</p>
        )}
        {status === "ready" && (
          <>
            <p style={text}>
              Click below to confirm you no longer want to receive emails from
              BEAUTYIMAGES.
            </p>
            <button style={button} onClick={confirm}>
              Confirm unsubscribe
            </button>
          </>
        )}
        {status === "submitting" && <p style={text}>Processing…</p>}
        {status === "done" && (
          <p style={text}>
            You've been unsubscribed. You won't receive further emails from us.
          </p>
        )}
        <p style={footer}>
          <Link to="/" style={link}>Return to beautyimages.com</Link>
        </p>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fafafa",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  padding: 24,
};
const card: React.CSSProperties = {
  maxWidth: 480,
  width: "100%",
  background: "#fff",
  padding: "40px 32px",
  border: "1px solid #eaeaea",
  textAlign: "center",
};
const h1: React.CSSProperties = {
  fontSize: 14,
  letterSpacing: "0.2em",
  fontWeight: 700,
  margin: "0 0 24px",
};
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: "0 0 20px" };
const text: React.CSSProperties = { fontSize: 14, color: "#55575d", lineHeight: 1.6, margin: "0 0 24px" };
const button: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  fontSize: 14,
  border: 0,
  padding: "12px 24px",
  cursor: "pointer",
  letterSpacing: "0.05em",
};
const footer: React.CSSProperties = { fontSize: 12, color: "#999", margin: "32px 0 0" };
const link: React.CSSProperties = { color: "#999", textDecoration: "underline" };
