import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { clearBasket } from "@/lib/basket";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Order complete — BEAUTYIMAGES" }],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  useEffect(() => {
    if (sessionId) clearBasket();
  }, [sessionId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      color: "#111",
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      padding: "80px 40px",
    }}>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{
          fontFamily: "'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif",
          fontSize: 56, fontWeight: 900, letterSpacing: "-0.035em",
          textTransform: "uppercase", margin: "0 0 16px",
        }}>
          {sessionId ? "Thank you" : "No order found"}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#444", margin: "0 0 28px" }}>
          {sessionId
            ? "Your payment was received. A receipt will be emailed to you shortly. Your licensed images are now available in your account."
            : "We couldn't find a recent order."}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/account" style={btn}>VIEW ACCOUNT</Link>
          <Link to="/" style={{ ...btn, background: "#fff", color: "#111", border: "1px solid #111" }}>
            BACK TO SEARCH
          </Link>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 38, padding: "0 16px",
  background: "#111", color: "#fff", textDecoration: "none",
  fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
};
