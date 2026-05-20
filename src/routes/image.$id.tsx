import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicImage, type PublicImageDetail } from "@/lib/search.functions";

export const Route = createFileRoute("/image/$id")({
  component: ImageDetail,
});

function ImageDetail() {
  const { id } = Route.useParams();
  const fetchImage = useServerFn(getPublicImage);
  const [img, setImg] = useState<PublicImageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"small" | "medium" | "large" | "pack">("medium");
  const [showLicence, setShowLicence] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchImage({ data: { id } })
      .then((r) => {
        if (!alive) return;
        setImg(r);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, fetchImage]);

  const TIERS = [
    { id: "small" as const, label: "Small", price: "£150.00", sub: "1280 px (4.27 x 2.85 cm) · 300 dpi" },
    { id: "medium" as const, label: "Medium", price: "£275.00", sub: "1957 x 1538 px (16.57 x 13.02 cm) · 300 dpi | 3 MP" },
    { id: "large" as const, label: "Large", price: "£375.00", sub: "4000 px (33.87 x 22.58 cm) · 300 dpi | 12 MP" },
    { id: "pack" as const, label: "5 Large images or 4K and HD videos", price: "£265.00", sub: "per download" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="img-root">
        <header className="img-header">
          <button
            type="button"
            className="img-back"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "/";
              }
            }}
          >
            ← BACK TO SEARCH RESULTS
          </button>
        </header>

        {/* BLACK STAGE — 150px black border on all four sides of the image */}
        <section className="img-stage">
          <div className="img-frame">
            {img?.signed_url ? (
              <img className="img-el" src={img.signed_url} alt={img.title ?? ""} />
            ) : (
              <div className="img-empty">{loading ? "LOADING…" : "IMAGE UNAVAILABLE"}</div>
            )}

            {/* LICENCE CARD — overlays the image, translucent */}
            {showLicence && (
              <aside className="licence-card">
                <button
                  type="button"
                  className="lc-toggle"
                  aria-label="Hide pricing"
                  onClick={() => setShowLicence(false)}
                >
                  <Eye size={16} />
                </button>

                <div className="lc-eyebrow">PURCHASE A LICENCE</div>
                <p className="lc-intro">
                  All Royalty-Free licences include global use rights, comprehensive protection, and simple pricing with volume discounts available.
                </p>

                <div className="lc-tiers">
                  {TIERS.map((t) => {
                    const active = tier === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`lc-tier${active ? " lc-tier--active" : ""}`}
                        onClick={() => setTier(t.id)}
                      >
                        <span className={`lc-radio${active ? " lc-radio--on" : ""}`} aria-hidden="true" />
                        <span className="lc-tier-body">
                          <span className="lc-tier-row">
                            <span className="lc-tier-label">{t.label}</span>
                            <span className="lc-tier-price">{t.price}</span>
                          </span>
                          <span className="lc-tier-sub">{t.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="lc-freeze">
                  <div className="lc-freeze-title">Market-freeze ↗</div>
                  <div className="lc-freeze-sub">
                    We'll remove this image from our site for as long as you need it.
                  </div>
                </div>

                <div className="lc-total">
                  <span className="lc-total-amount">
                    {TIERS.find((t) => t.id === tier)?.price}
                  </span>
                  <span className="lc-total-currency">GBP</span>
                </div>

                <button type="button" className="lc-cta">ADD TO BASKET</button>
              </aside>
            )}

            {!showLicence && (
              <button
                type="button"
                className="lc-mini-cta"
                onClick={() => setShowLicence(true)}
              >
                <span className="lc-mini-eye" aria-hidden="true">
                  <EyeOff size={14} />
                </span>
                <span className="lc-mini-label">ADD TO BASKET</span>
                <span className="lc-mini-price">
                  {TIERS.find((t) => t.id === tier)?.price}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* WHITE DETAILS SECTION below the black stage */}
        {img && (
          <section className="img-details">
            <div className="img-meta-num">#{String(img.image_number).padStart(5, "0")}</div>
            {img.title && <h1 className="img-meta-title">{img.title}</h1>}
            {img.caption && <p className="img-meta-caption">{img.caption}</p>}

            {img.keywords.length > 0 && (
              <div className="img-meta-kw-block">
                <div className="img-meta-kw-label">KEYWORDS</div>
                <div className="img-meta-kw">
                  {img.keywords.map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="img-meta-grid">
              {img.category && (
                <div className="img-meta-cell">
                  <div className="img-meta-cell-label">CATEGORY</div>
                  <div className="img-meta-cell-value">{img.category}</div>
                </div>
              )}
              {img.pricing_tier && (
                <div className="img-meta-cell">
                  <div className="img-meta-cell-label">PRICING TIER</div>
                  <div className="img-meta-cell-value">{img.pricing_tier}</div>
                </div>
              )}
              <div className="img-meta-cell">
                <div className="img-meta-cell-label">USAGE</div>
                <div className="img-meta-cell-value">Rights-managed · Real photography · No AI</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

const FRAME = 150;

const CSS = `
.img-root { background: #000; color: #e8e8e8; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.img-root * { box-sizing: border-box; }

.img-header { position: fixed; top: 0; left: 0; right: 0; z-index: 20; padding: 22px 36px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
.img-back { pointer-events: auto; background: none; border: 0; padding: 0; cursor: pointer; color: #fff; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; opacity: 0.85; transition: opacity 0.2s ease, color 0.2s ease; font-family: inherit; }
.img-back:hover { opacity: 1; color: #D75F68; }

/* BLACK STAGE — 150px black frame around the image on all sides */
.img-stage {
  background: #000;
  padding: ${FRAME}px;
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh;
}

.img-frame {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.img-el {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - ${FRAME * 2}px);
  width: auto; height: auto;
  background: #0a0a0a;
}

.img-empty {
  display: flex; align-items: center; justify-content: center;
  width: 60vw; height: 60vh;
  font-size: 11px; letter-spacing: 0.25em; color: #555;
  background: #0a0a0a;
}

/* LICENCE CARD — overlays the image, top-right, translucent */
.licence-card {
  position: absolute;
  z-index: 5;
  right: 0; top: 0;
  width: 360px;
  padding: 28px 26px 24px;
  color: #f0f0f0;
  font-size: 13px;
  line-height: 1.5;
  background:
    linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.2)) padding-box,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) top/100% 1px no-repeat,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) bottom/100% 1px no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) left/1px 100% no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) right/1px 100% no-repeat,
    rgba(0,0,0,0.2);
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}

.lc-toggle {
  position: absolute; top: 10px; right: 10px;
  background: rgba(0,0,0,0.4); color: #fff;
  border: 0; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s ease, color 0.2s ease;
  z-index: 6;
}
.lc-toggle:hover { background: #D75F68; color: #fff; }

.lc-mini-cta {
  position: absolute; right: 0; top: 0;
  display: flex; align-items: center; gap: 14px;
  padding: 12px 18px 12px 14px;
  background: #D75F68; color: #fff; border: 0; cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 600;
  letter-spacing: 0.2em; text-transform: uppercase;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  transition: background 0.2s ease;
  z-index: 6;
}
.lc-mini-cta:hover { background: #000; box-shadow: inset 0 0 0 1px #D75F68, 0 4px 18px rgba(0,0,0,0.35); }
.lc-mini-eye { display: flex; align-items: center; justify-content: center; opacity: 0.9; }
.lc-mini-label { font-weight: 600; }
.lc-mini-price { font-weight: 700; letter-spacing: 0.05em; font-variant-numeric: tabular-nums; padding-left: 12px; border-left: 1px solid rgba(255,255,255,0.4); }

.lc-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #fff; margin-bottom: 14px; font-weight: 700; }
.lc-intro { font-size: 11px; line-height: 1.55; color: #c2c2c2; margin-bottom: 20px; padding-right: 28px; }

.lc-tiers { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.08); margin-bottom: 18px; }
.lc-tier {
  all: unset; cursor: pointer;
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 12px; background: rgba(255,255,255,0.08);
  transition: background 0.15s ease;
}
.lc-tier:hover { background: rgba(255,255,255,0.15); }
.lc-tier--active { background: rgba(255,255,255,0.22); }

.lc-radio { flex: 0 0 14px; width: 14px; height: 14px; border: 1px solid #ccc; border-radius: 50%; margin-top: 3px; position: relative; }
.lc-radio--on { border-color: #fff; }
.lc-radio--on::after { content: ""; position: absolute; inset: 2px; background: #fff; border-radius: 50%; }

.lc-tier-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.lc-tier-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.lc-tier-label { font-size: 12px; font-weight: 500; color: #fff; }
.lc-tier-price { font-size: 13px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
.lc-tier-sub { font-size: 10px; color: #ddd; letter-spacing: 0.02em; }

.lc-freeze { padding: 10px 12px; background: rgba(20,20,20,0.5); margin-bottom: 16px; border-left: 2px solid #D75F68; }
.lc-freeze-title { font-size: 11px; color: #D75F68; font-weight: 600; margin-bottom: 4px; }
.lc-freeze-sub { font-size: 10px; color: #aaa; line-height: 1.5; }

.lc-total { display: flex; align-items: baseline; gap: 8px; justify-content: center; padding: 8px 0 14px; }
.lc-total-amount { font-size: 26px; font-weight: 300; color: #fff; font-variant-numeric: tabular-nums; }
.lc-total-currency { font-size: 11px; color: #aaa; letter-spacing: 0.2em; }

.lc-cta {
  all: unset; cursor: pointer; display: block; width: 100%;
  text-align: center; padding: 14px; background: #D75F68; color: #fff;
  font-size: 12px; font-weight: 600; letter-spacing: 0.2em;
  transition: background 0.2s ease;
}
.lc-cta:hover { background: #000; box-shadow: inset 0 0 0 1px #D75F68; }

/* WHITE DETAILS SECTION below the black stage */
.img-details {
  background: #fff;
  color: #111;
  padding: 64px ${FRAME}px 120px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.img-meta-num { font-size: 11px; letter-spacing: 0.3em; color: #888; margin-bottom: 16px; font-weight: 600; }
.img-meta-title { font-size: 32px; font-weight: 500; color: #000; margin: 0 0 16px; max-width: 820px; line-height: 1.2; letter-spacing: -0.01em; }
.img-meta-caption { font-size: 15px; color: #444; max-width: 820px; line-height: 1.65; margin: 0 0 36px; }

.img-meta-kw-block { margin-bottom: 40px; }
.img-meta-kw-label { font-size: 10px; letter-spacing: 0.3em; color: #888; margin-bottom: 12px; font-weight: 600; }
.img-meta-kw { display: flex; flex-wrap: wrap; gap: 6px; }
.img-meta-kw span { font-size: 11px; letter-spacing: 0.05em; padding: 6px 12px; background: #f3f3f3; color: #333; border: 1px solid #e8e8e8; }

.img-meta-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 28px; padding-top: 32px; border-top: 1px solid #eee;
}
.img-meta-cell-label { font-size: 10px; letter-spacing: 0.3em; color: #888; margin-bottom: 8px; font-weight: 600; }
.img-meta-cell-value { font-size: 14px; color: #111; }

@media (max-width: 900px) {
  .img-stage { padding: 60px; }
  .img-el { max-height: calc(100vh - 120px); }
  .img-details { padding: 48px 32px 80px; }
  .licence-card { width: calc(100% - 32px); right: 16px; bottom: 16px; }
  .img-meta-title { font-size: 24px; }
}
@media (max-width: 600px) {
  .img-stage { padding: 24px; padding-top: 70px; }
  .img-el { max-height: calc(100vh - 48px); }
  .licence-card { padding: 20px 18px 18px; }
}
`;
