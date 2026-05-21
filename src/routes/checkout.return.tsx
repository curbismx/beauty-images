import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Copy, Check } from "lucide-react";
import { clearBasket } from "@/lib/basket";
import { getOrderBySession, type OrderSummary } from "@/lib/order.functions";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Your downloads — BEAUTYIMAGES" }],
  }),
  component: CheckoutReturn,
});

const TIER_LABEL: Record<string, string> = { small: "S", medium: "M", large: "L" };
const TIER_NAME: Record<string, string> = { small: "Small", medium: "Medium", large: "Large" };

function fmtPrice(p: number, ccy = "GBP") {
  const symbol = ccy === "GBP" ? "£" : ccy === "USD" ? "$" : ccy === "EUR" ? "€" : "";
  return `${symbol}${p.toFixed(2)}`;
}

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const fetchOrder = useServerFn(getOrderBySession);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    clearBasket();
    let alive = true;
    let attempt = 0;
    const tryFetch = () => {
      fetchOrder({ data: { sessionId } })
        .then((o) => {
          if (!alive) return;
          if (!o.found && attempt < 5) {
            // Webhook may not have arrived yet — retry with backoff.
            attempt += 1;
            setTimeout(tryFetch, 1500);
          } else {
            setOrder(o);
            setLoading(false);
          }
        })
        .catch(() => {
          if (alive) setLoading(false);
        });
    };
    tryFetch();
    return () => { alive = false; };
  }, [sessionId, fetchOrder]);

  const pageUrl = typeof window !== "undefined" && sessionId
    ? `${window.location.origin}/checkout/return?session_id=${sessionId}`
    : "";

  const copyLink = async () => {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ret-root">
        <Link to="/" className="ret-back">← BACK TO SEARCH</Link>

        <div className="ret-wrap">
          <h1 className="ret-h1">
            {sessionId ? "Thank you" : "No order found"}
          </h1>

          {!sessionId && (
            <p className="ret-lede">We couldn't find a recent order.</p>
          )}

          {sessionId && loading && (
            <p className="ret-lede">Preparing your downloads…</p>
          )}

          {sessionId && !loading && order && !order.found && (
            <p className="ret-lede">
              Your payment was received but we're still confirming the order.
              Refresh this page in a moment, or use the link emailed to you.
            </p>
          )}

          {sessionId && !loading && order && order.found && (
            <>
              <p className="ret-lede">
                Your payment was received. Your licensed images are ready to
                download below. We've also emailed you a link to this page so
                you can return any time.
              </p>

              <div className="ret-bookmark">
                <div className="ret-bookmark-label">BOOKMARK THIS LINK</div>
                <div className="ret-bookmark-row">
                  <code className="ret-bookmark-url">{pageUrl}</code>
                  <button type="button" className="ret-copy" onClick={copyLink}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>

              <div className="ret-summary">
                <span>{order.items.length} {order.items.length === 1 ? "LICENCE" : "LICENCES"}</span>
                <span className="ret-summary-total">TOTAL {fmtPrice(order.total, order.currency)}</span>
              </div>

              <div className="ret-grid">
                {order.items.map((it) => {
                  const href = `/api/public/download?session_id=${encodeURIComponent(sessionId)}&image_id=${encodeURIComponent(it.image_id)}`;
                  return (
                    <div key={it.sale_id} className="ret-card">
                      <div className="ret-thumb">
                        {it.preview_url
                          ? <img src={it.preview_url} alt={it.title ?? it.caption ?? ""} loading="lazy" />
                          : <div className="ret-thumb-fallback" />}
                        <span className="ret-tier-chip">{TIER_LABEL[it.tier] ?? "M"}</span>
                      </div>
                      <div className="ret-meta">
                        <div className="ret-num">
                          #{String(it.image_number).padStart(8, "0")}
                          <span className="ret-tier-name"> · {TIER_NAME[it.tier] ?? it.tier}</span>
                          <span className="ret-edge"> · {it.tier_max_edge}px</span>
                        </div>
                        {it.title && <div className="ret-title">{it.title}</div>}
                      </div>
                      <a className="ret-dl" href={href} download>
                        <Download size={14} /> DOWNLOAD
                      </a>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="ret-actions">
            <Link to="/account" className="ret-btn">VIEW ACCOUNT</Link>
            <Link to="/" className="ret-btn ret-btn--ghost">BACK TO SEARCH</Link>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
.ret-root { min-height: 100vh; background: #fff; color: #111; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.ret-root * { box-sizing: border-box; }
.ret-back {
  display: inline-block; padding: 24px 40px 0;
  font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700;
  color: #111; text-decoration: none;
}
.ret-back:hover { color: #D75F68; }
.ret-wrap { padding: 32px 40px 120px; max-width: 1200px; }
.ret-h1 {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: clamp(40px, 6vw, 72px); font-weight: 900; letter-spacing: -0.035em;
  text-transform: uppercase; line-height: 1; margin: 0 0 18px;
}
.ret-lede { font-size: 14px; line-height: 1.6; color: #444; margin: 0 0 24px; max-width: 640px; }

.ret-bookmark {
  border: 1px solid #111; padding: 14px 16px; margin: 0 0 32px; max-width: 720px;
  display: flex; flex-direction: column; gap: 8px;
}
.ret-bookmark-label { font-size: 10px; letter-spacing: 0.3em; font-weight: 700; color: #111; }
.ret-bookmark-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.ret-bookmark-url {
  flex: 1; min-width: 0; font-family: ui-monospace, Menlo, monospace;
  font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  background: #fafafa; padding: 8px 10px;
}
.ret-copy {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px; background: #111; color: #fff; border: 0;
  font-size: 10px; font-weight: 700; letter-spacing: 0.2em; cursor: pointer;
}
.ret-copy:hover { background: #D75F68; }

.ret-summary {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 11px; letter-spacing: 0.25em; font-weight: 700; color: #777;
  border-top: 1px solid #eee; padding: 16px 0; margin-bottom: 20px;
}
.ret-summary-total { color: #111; font-size: 14px; }

.ret-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px; margin-bottom: 48px;
}
.ret-card {
  display: flex; flex-direction: column; gap: 10px; background: #fafafa;
}
.ret-thumb { position: relative; }
.ret-thumb img, .ret-thumb-fallback {
  width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; background: #eee;
}
.ret-tier-chip {
  position: absolute; top: 8px; left: 8px;
  min-width: 28px; height: 28px; padding: 0 8px;
  background: #111; color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
}
.ret-meta { padding: 0 2px; display: flex; flex-direction: column; gap: 4px; }
.ret-num { font-size: 10px; letter-spacing: 0.25em; color: #999; text-transform: uppercase; font-variant-numeric: tabular-nums; }
.ret-tier-name, .ret-edge { color: #111; }
.ret-edge { color: #999; }
.ret-title { font-size: 12px; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ret-dl {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  margin: 8px 2px 12px;
  height: 38px; background: #D75F68; color: #fff; text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.25em;
  transition: background 0.2s ease;
}
.ret-dl:hover { background: #b94e56; }

.ret-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.ret-btn {
  display: inline-flex; align-items: center; height: 38px; padding: 0 16px;
  background: #111; color: #fff; text-decoration: none;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
}
.ret-btn--ghost { background: #fff; color: #111; border: 1px solid #111; }

@media (max-width: 768px) {
  .ret-back { padding: 18px 22px 0; }
  .ret-wrap { padding: 24px 22px 80px; }
  .ret-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
}
`;
