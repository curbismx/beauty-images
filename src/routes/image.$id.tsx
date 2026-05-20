import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, Check, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicImage, type PublicImageDetail } from "@/lib/search.functions";
import {
  addToLightbox,
  removeFromLightbox,
  getLightbox,
  subscribeLightbox,
} from "@/lib/lightbox";

export const Route = createFileRoute("/image/$id")({
  component: ImageDetail,
});

type TierId = "small" | "medium" | "large";

const TIERS: Array<{
  id: TierId;
  label: string;
  price: string;
  sub: string;
  description: string;
}> = [
  {
    id: "small",
    label: "Small",
    price: "£150.00",
    sub: "1280 px · 300 dpi",
    description:
      "Small licence — 1280 px on the long edge at 300 dpi. Perfect for web banners, social media, blog headers and small editorial use. Includes worldwide rights for digital publication for 12 months.",
  },
  {
    id: "medium",
    label: "Medium",
    price: "£275.00",
    sub: "1957 × 1538 px · 3 MP",
    description:
      "Medium licence — 1957 × 1538 px (16.6 × 13.0 cm) at 300 dpi, around 3 MP. Suited to magazine spreads, brochures, packaging mock-ups and quarter-page print. Worldwide print + digital rights for 12 months.",
  },
  {
    id: "large",
    label: "Large",
    price: "£375.00",
    sub: "4000 px · 12 MP",
    description:
      "Large licence — 4000 px on the long edge (33.9 × 22.6 cm) at 300 dpi, around 12 MP. Designed for full-page print, posters, billboards and high-end advertising campaigns. Worldwide print + digital rights for 12 months.",
  },
];

function ImageDetail() {
  const { id } = Route.useParams();
  const fetchImage = useServerFn(getPublicImage);
  const [img, setImg] = useState<PublicImageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<TierId>("medium");
  const [showLicence, setShowLicence] = useState(true);

  const lbJson = useSyncExternalStore(
    subscribeLightbox,
    () => JSON.stringify(getLightbox()),
    () => "[]",
  );
  const inLightbox = (JSON.parse(lbJson) as string[]).includes(id);

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

  const activeTier = TIERS.find((t) => t.id === tier)!;




  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="img-root">
        <header className="img-header">
          <button
            type="button"
            className="img-back"
            onClick={() => {
              // Always go to "/" — index restores the previous search/scroll from sessionStorage.
              window.location.href = "/";
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
          </div>
        </section>

        {/* LICENCE PANEL — directly under the image, flush-left */}
        <section className="licence-wrap">
          {showLicence ? (
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
              <div className="lc-detail">
                <div className="lc-detail-head">
                  <span className="lc-detail-tier">{activeTier.label.toUpperCase()}</span>
                  <span className="lc-detail-price">{activeTier.price}</span>
                </div>
                <p className="lc-detail-text">{activeTier.description}</p>
              </div>

              <div className="lc-tiles">
                {TIERS.map((t) => {
                  const active = tier === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`lc-tile${active ? " lc-tile--active" : ""}`}
                      onClick={() => setTier(t.id)}
                    >
                      <span className="lc-tile-label">{t.label}</span>
                      <span className="lc-tile-price">{t.price}</span>
                      <span className="lc-tile-sub">{t.sub}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`lc-tile lc-tile--lb${inLightbox ? " lc-tile--lb-on" : ""}`}
                  onClick={() => (inLightbox ? removeFromLightbox(id) : addToLightbox(id))}
                >
                  <span className="lc-tile-lb-icon" aria-hidden="true">
                    {inLightbox ? <Check size={18} /> : <Plus size={18} />}
                  </span>
                  <span className="lc-tile-lb-label">
                    {inLightbox ? "IN LIGHTBOX" : "ADD TO LIGHTBOX"}
                  </span>
                </button>
                <button type="button" className="lc-tile lc-tile--cta">
                  <span className="lc-tile-cta-label">ADD TO BASKET</span>
                  <span className="lc-tile-cta-price">
                    {activeTier.price}
                  </span>
                </button>
              </div>
            </aside>
          ) : (
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

/* BLACK STAGE — 150px black frame around the image */
.img-stage {
  background: #000;
  padding: ${FRAME}px ${FRAME}px 75px;
  display: flex; align-items: flex-start; justify-content: flex-start;
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

/* LICENCE PANEL — sits flush-left under the image, on the black stage */
.licence-wrap {
  background: #000;
  padding: 0 ${FRAME}px 75px;
}

.licence-card {
  position: relative;
  display: inline-block;
  max-width: 100%;
  padding: 28px 28px 24px;
  color: #f0f0f0;
  font-size: 13px;
  line-height: 1.5;
  background:
    linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.06)) padding-box,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) top/100% 1px no-repeat,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) bottom/100% 1px no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) left/1px 100% no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 6px) right/1px 100% no-repeat,
    rgba(255,255,255,0.06);
}

.lc-toggle {
  position: absolute; top: 10px; right: 10px;
  background: rgba(255,255,255,0.1); color: #fff;
  border: 0; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s ease, color 0.2s ease;
}
.lc-toggle:hover { background: #D75F68; color: #fff; }

.lc-mini-cta {
  display: inline-flex; align-items: stretch; gap: 0;
  background: #D75F68; color: #fff; border: 0; cursor: pointer; padding: 0;
  font-family: inherit; font-size: 12px; font-weight: 600;
  letter-spacing: 0.2em; text-transform: uppercase;
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  transition: background 0.2s ease;
}
.lc-mini-cta:hover { background: #b94e56; }
.lc-mini-eye {
  display: flex; align-items: center; justify-content: center;
  padding: 12px 14px;
  border-right: 2px solid #000;
}
.lc-mini-label { display: flex; align-items: center; padding: 12px 0 12px 16px; font-weight: 600; }
.lc-mini-price { display: flex; align-items: center; font-weight: 700; letter-spacing: 0.05em; font-variant-numeric: tabular-nums; padding: 12px 18px 12px 12px; margin-left: 12px; border-left: 1px solid rgba(255,255,255,0.4); }

.lc-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #fff; margin-bottom: 14px; font-weight: 700; }
.lc-intro { font-size: 11px; line-height: 1.55; color: #c2c2c2; margin: 0 0 22px; max-width: 560px; }

/* TILES for each size + the ADD TO BASKET tile */
.lc-tiles { display: grid; grid-template-columns: repeat(4, 130px); gap: 10px; }
.lc-tile {
  all: unset; cursor: pointer;
  width: 130px; height: 110px; padding: 12px;
  display: flex; flex-direction: column; justify-content: space-between;
  background: rgba(255,255,255,0.08);
  outline: 1px solid rgba(255,255,255,0.18);
  transition: background 0.15s ease, outline-color 0.15s ease;
  box-sizing: border-box;
}
.lc-tile:hover { background: rgba(255,255,255,0.15); }
.lc-tile--active { background: rgba(255,255,255,0.22); outline: 1px solid #fff; }
.lc-tile-label { font-size: 11px; font-weight: 600; color: #fff; letter-spacing: 0.08em; text-transform: uppercase; }
.lc-tile-price { font-size: 18px; font-weight: 400; color: #fff; font-variant-numeric: tabular-nums; }
.lc-tile-sub { font-size: 9px; color: #cfcfcf; line-height: 1.4; }

.lc-tile--cta {
  background: #D75F68;
  outline: 1px solid #D75F68;
  align-items: center; justify-content: center;
  text-align: center; gap: 8px;
}
.lc-tile--cta:hover { background: #b94e56; outline-color: #b94e56; }
.lc-tile-cta-label { font-size: 11px; font-weight: 700; letter-spacing: 0.2em; color: #fff; text-transform: uppercase; }
.lc-tile-cta-price { font-size: 18px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }



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
  .img-stage { padding: 60px 60px 75px; }
  .img-el { max-height: calc(100vh - 120px); }
  .licence-wrap { padding: 0 60px 75px; }
  .lc-tiles { grid-template-columns: repeat(2, 1fr); }
  .lc-tile { width: 100%; height: 110px; }
  .img-details { padding: 48px 32px 80px; }
  .img-meta-title { font-size: 24px; }
}
@media (max-width: 600px) {
  .img-stage { padding: 70px 24px 75px; }
  .img-el { max-height: calc(100vh - 100px); }
  .licence-wrap { padding: 0 24px 75px; }
  .licence-card { padding: 20px 18px 18px; }
}
  .licence-card { padding: 20px 18px 18px; }
}
`;
