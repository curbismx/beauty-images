import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, LayoutGrid, Rows3 } from "lucide-react";
import {
  getBasket,
  removeFromBasket,
  subscribeBasket,
  type BasketItem,
} from "@/lib/basket";
import {
  getPublicImagesByIds,
  type PublicSearchResult,
} from "@/lib/search.functions";
import { useMasonryCols } from "@/lib/view-mode";
import { useSession } from "@/lib/use-session";
import { StripeBasketCheckout } from "@/components/StripeBasketCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useRegionPricing, formatPrice, type Tier } from "@/lib/pricing";

export const Route = createFileRoute("/basket")({
  head: () => ({
    meta: [
      { title: "Basket — BEAUTYIMAGES" },
      { name: "description", content: "Your selected images and licences." },
    ],
  }),
  component: BasketPage,
});

const TIER_LABEL: Record<string, string> = { small: "S", medium: "M", large: "L" };
const TIER_NAME: Record<string, string> = { small: "Small", medium: "Medium", large: "Large" };

function useBasketJson(): string {
  return useSyncExternalStore(
    subscribeBasket,
    () => JSON.stringify(getBasket()),
    () => "[]",
  );
}

function BasketPage() {
  const basketJson = useBasketJson();
  const basket: BasketItem[] = JSON.parse(basketJson);
  const fetchImages = useServerFn(getPublicImagesByIds);
  const [items, setItems] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [masonry, setMasonry] = useState(false);
  const cols = useMasonryCols();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { session } = useSession();
  const router = useRouter();

  const checkoutItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of basket) {
      const priceId = TIER_PRICE_ID[b.tier];
      if (!priceId) continue;
      counts.set(priceId, (counts.get(priceId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([priceId, quantity]) => ({ priceId, quantity }));
  }, [basketJson]);

  const checkoutImageIds = useMemo(
    () => Array.from(new Set(basket.map((b) => b.id))),
    [basketJson],
  );

  // Per-image tier mapping, packed as "imageId:s,imageId:m" etc. for Stripe metadata.
  const checkoutImageTiers = useMemo(() => {
    return basket
      .map((b) => `${b.id}:${b.tier.charAt(0)}`)
      .join(",");
  }, [basketJson]);

  const uniqueIds = Array.from(new Set(basket.map((b) => b.id)));
  const idsKey = uniqueIds.join(",");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (uniqueIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    fetchImages({ data: { ids: uniqueIds } })
      .then((r) => {
        if (!alive) return;
        // Prune basket entries whose image no longer exists / is unpublished.
        const returned = new Set(r.map((x) => x.id));
        const stale = uniqueIds.filter((id) => !returned.has(id));
        if (stale.length > 0) {
          const staleSet = new Set(stale);
          basket
            .filter((b) => staleSet.has(b.id))
            .forEach((b) => removeFromBasket(b.id, b.tier));
        }
        setItems(r);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [idsKey, fetchImages]);

  const total = basket.reduce((s, b) => s + (TIER_PRICE[b.tier] ?? 0), 0);

  const renderCard = useCallback((b: BasketItem, idx: number) => {
    const r = items.find((x) => x.id === b.id);
    return (
      <div key={`${b.id}-${b.tier}-${idx}`} className="search-result-card">
        <Link to="/image/$id" params={{ id: b.id }} search={{ from: "basket" }} className="src-link">
          {r?.signed_url ? (
            <img src={r.signed_url} alt={r.title ?? r.caption ?? ""} loading="lazy" />
          ) : (
            <div className="search-result-fallback" />
          )}
        </Link>
        <button
          type="button"
          className="src-remove"
          aria-label="Remove from basket"
          onClick={() => removeFromBasket(b.id, b.tier)}
        >
          <X size={14} />
        </button>
        <span className="src-tier">{TIER_LABEL[b.tier] ?? b.tier.charAt(0).toUpperCase()}</span>
        <figcaption>
          <div className="src-num">
            {r ? `#${String(r.image_number).padStart(8, "0")}` : "—"}
            <span className="src-tier-name"> · {TIER_NAME[b.tier] ?? b.tier}</span>
          </div>
          <div className="src-row">
            {r?.title && <span className="src-title">{r.title}</span>}
            <span className="src-price">{fmt(TIER_PRICE[b.tier] ?? 0)}</span>
          </div>
        </figcaption>
      </div>
    );
  }, [items]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lb-root">
        <Link
          to="/"
          className="lb-back"
          onClick={(e) => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              e.preventDefault();
              router.history.back();
            }
          }}
        >← BACK</Link>

        <div className="search-results">
          <div className="search-results-header">
            <div className="srh-text">
              BASKET
              <span className="srp-meta">
                {" "}
                · {basket.length} {basket.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
            {basket.length > 0 && (
              <div className="srh-actions">
                <button
                  type="button"
                  className="srh-iconbtn"
                  aria-label={masonry ? "Show as square grid" : "Show full images (masonry)"}
                  title={masonry ? "Square grid" : "Masonry"}
                  onClick={() => setMasonry((v) => !v)}
                >
                  {masonry ? <LayoutGrid size={16} /> : <Rows3 size={16} />}
                </button>
              </div>
            )}
          </div>

          {loading && <div className="search-results-status">LOADING…</div>}

          {!loading && basket.length === 0 && (
            <div className="search-results-status">
              YOUR BASKET IS EMPTY — ADD A LICENCE FROM AN IMAGE
            </div>
          )}

          {!loading && basket.length > 0 && !masonry && (
            <div className="search-results-grid">
              {basket.map((b, i) => renderCard(b, i))}
            </div>
          )}

          {!loading && basket.length > 0 && masonry && (
            <div className="search-results-masonry">
              {Array.from({ length: cols }, (_, ci) => (
                <div className="masonry-col" key={ci}>
                  {basket.filter((_, i) => i % cols === ci).map((b, i) => renderCard(b, ci + i * cols))}
                </div>
              ))}
            </div>
          )}

          {!loading && basket.length > 0 && (
            <div className="basket-checkout">
              <div className="basket-total">
                <span className="basket-total-label">TOTAL</span>
                <span className="basket-total-value">{fmt(total)}</span>
              </div>
              <button
                type="button"
                className="basket-checkout-btn"
                onClick={() => setCheckoutOpen(true)}
              >
                CHECKOUT · {fmt(total)}
              </button>
            </div>
          )}
        </div>

        {checkoutOpen && (
          <div className="lb-modal-backdrop" onClick={() => setCheckoutOpen(false)}>
            <div
              className="lb-modal lb-modal--checkout"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="lb-checkout-head">
                <div className="lb-modal-title">CHECKOUT</div>
                <button
                  type="button"
                  className="lb-checkout-close"
                  aria-label="Close checkout"
                  onClick={() => setCheckoutOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <PaymentTestModeBanner />
              <div className="lb-checkout-body">
                <StripeBasketCheckout
                  items={checkoutItems}
                  imageIds={checkoutImageIds}
                  imageTiers={checkoutImageTiers}
                  customerEmail={session?.user?.email ?? undefined}
                  userId={session?.user?.id}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.lb-root { min-height: 100vh; background: #fff; color: #111; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.lb-root * { box-sizing: border-box; }

.lb-back {
  display: inline-block;
  padding: 24px 40px 0;
  font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700;
  color: #111; text-decoration: none;
  transition: color 0.2s ease;
}
.lb-back:hover { color: #D75F68; }

.search-results { padding: 32px 40px 120px; }

.search-results-header {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: clamp(28px, 4.2vw, 56px);
  font-weight: 900; text-transform: uppercase;
  letter-spacing: -0.035em; line-height: 1.15; color: #000;
  margin-bottom: 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
.search-results-header .srh-text { flex: 1; min-width: 0; }
.srh-actions { display: inline-flex; align-items: center; gap: 10px; }
.search-results-header .srh-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  background: #fff; color: #111; border: 1px solid #111; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.search-results-header .srh-iconbtn:hover { background: #111; color: #fff; }
.search-results-header .srp-meta { color: #999; font-weight: 900; }

.search-results-status {
  font-size: 11px; letter-spacing: 0.3em; color: #777; text-transform: uppercase;
  padding: 40px 0 200px;
}

.search-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}

.search-results-masonry { display: flex; align-items: flex-start; gap: 24px; }
.masonry-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 24px; }
.search-results-masonry .search-result-card { display: block; margin: 0; }
.search-results-masonry .search-result-card:hover { transform: none; }
.search-results-masonry .search-result-card img,
.search-results-masonry .search-result-fallback {
  width: 100%; height: auto; aspect-ratio: auto; object-fit: initial;
  display: block; background: #eee;
}

.search-result-card {
  position: relative;
  display: flex; flex-direction: column;
  background: #fafafa;
  transition: transform 0.25s ease;
}
.search-result-card:hover { transform: translateY(-2px); }
.src-link { display: block; }
.search-result-card img,
.search-result-fallback {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: #eee;
}
.search-result-card figcaption {
  padding: 10px 2px 0;
  display: flex; flex-direction: column; gap: 4px;
}
.search-result-card .src-num {
  font-size: 10px; letter-spacing: 0.25em; color: #999; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.src-tier-name { color: #111; }
.search-result-card .src-row {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
}
.search-result-card .src-title {
  font-size: 12px; color: #111; letter-spacing: 0.04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
}
.search-result-card .src-price {
  font-size: 12px; color: #111; font-weight: 700; letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}
.src-remove {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px; border: 0;
  background: rgba(0,0,0,0.6); color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s ease; z-index: 2;
}
.src-remove:hover { background: #D75F68; }
.src-tier {
  position: absolute; top: 8px; left: 8px;
  min-width: 28px; height: 28px; padding: 0 8px;
  background: #111; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  z-index: 2;
}

/* Checkout footer */
.basket-checkout {
  margin-top: 48px;
  border-top: 1px solid #eee;
  padding-top: 28px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 18px;
}
.basket-total {
  display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
}
.basket-total-label {
  font-size: 22px; font-weight: 900; letter-spacing: 0.04em; color: #111; text-transform: uppercase;
}
.basket-total-value {
  font-size: 36px; font-weight: 900; color: #111;
  font-variant-numeric: tabular-nums;
}
.basket-checkout-btn {
  display: inline-flex; align-items: center; gap: 10px;
  height: 38px; padding: 0 18px;
  border: 0;
  background: #D75F68;
  color: #fff;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.basket-checkout-btn:hover { background: #b94e56; }
.basket-checkout-btn:active { transform: translateY(1px); }

/* Modal (reused from lightbox styling) */
.lb-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  animation: lb-fade 0.15s ease;
}
@keyframes lb-fade { from { opacity: 0; } to { opacity: 1; } }
.lb-modal {
  background: #fff; color: #111;
  width: min(440px, calc(100vw - 32px));
  border: 1px solid #111;
  padding: 28px 28px 22px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.35);
}
.lb-modal--checkout {
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  padding: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.lb-checkout-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 24px 14px;
  border-bottom: 1px solid #eee;
}
.lb-checkout-close {
  width: 32px; height: 32px; border: 0; background: transparent; color: #111;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; transition: color 0.15s ease;
}
.lb-checkout-close:hover { color: #D75F68; }
.lb-checkout-body {
  flex: 1; overflow-y: auto; padding: 16px 24px 24px;
}
.lb-modal-title {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: 32px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase;
  line-height: 1; margin: 0;
}
.lb-modal-body { font-size: 13px; line-height: 1.5; color: #444; margin-bottom: 22px; }
.lb-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.lb-btn {
  height: 38px; padding: 0 16px; border: 1px solid #111;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  cursor: pointer; transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.lb-btn--ghost { background: #fff; color: #111; }
.lb-btn--ghost:hover { background: #111; color: #fff; }

@media (max-width: 768px) {
  .lb-back { padding: 18px 22px 0; }
  .search-results { padding: 24px 22px 80px; }
  .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .search-result-card { min-width: 0; }
  .search-results-masonry { gap: 14px; }
  .masonry-col { gap: 14px; }
}
`;
