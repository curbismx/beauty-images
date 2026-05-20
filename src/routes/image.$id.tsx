import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicImage, type PublicImageDetail } from "@/lib/search.functions";

export const Route = createFileRoute("/image/$id")({
  component: ImageDetail,
});

type Orientation = "landscape" | "portrait" | "square";

function ImageDetail() {
  const { id } = Route.useParams();
  const fetchImage = useServerFn(getPublicImage);
  const [img, setImg] = useState<PublicImageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [tier, setTier] = useState<"small" | "medium" | "large" | "pack">("medium");

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

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const r = el.naturalWidth / el.naturalHeight;
    if (r > 1.05) setOrientation("landscape");
    else if (r < 0.95) setOrientation("portrait");
    else setOrientation("square");
  };

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
            ← BEAUTYIMAGES
          </button>
        </header>

        <div className={`img-stage img-stage--${orientation}`}>
          {/* Image positioned tight to top-left of the square stage */}
          <div className="img-wrap">
            {img?.signed_url ? (
              <img src={img.signed_url} alt={img.title ?? ""} onLoad={onImgLoad} />
            ) : (
              <div className="img-empty">{loading ? "LOADING…" : "IMAGE UNAVAILABLE"}</div>
            )}
          </div>

          {/* Licence card sits in the negative space — top-right for
              portrait, bottom-right for landscape, overlay for square */}
          <aside className="licence-card">
            <div className="lc-corner lc-corner--tl" />
            <div className="lc-corner lc-corner--tr" />
            <div className="lc-corner lc-corner--bl" />
            <div className="lc-corner lc-corner--br" />

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

          {img && (
            <div className="img-meta">
              <div className="img-meta-num">#{String(img.image_number).padStart(5, "0")}</div>
              {img.title && <div className="img-meta-title">{img.title}</div>}
              {img.caption && <div className="img-meta-caption">{img.caption}</div>}
              {img.keywords.length > 0 && (
                <div className="img-meta-kw">
                  {img.keywords.slice(0, 24).map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const CSS = `
.img-root { background: #000; color: #e8e8e8; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.img-root * { box-sizing: border-box; }

.img-header { position: fixed; top: 0; left: 0; right: 0; z-index: 10; padding: 22px 36px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; }
.img-back { pointer-events: auto; color: #fff; text-decoration: none; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; opacity: 0.85; transition: opacity 0.2s ease; }
.img-back:hover { opacity: 1; color: #D75F68; }

/* Square stage — width == height == viewport width */
.img-stage { position: relative; width: 100%; height: 100vw; background: #000; }

/* IMAGE WRAP — tight to top-left */
.img-wrap { position: absolute; top: 0; left: 0; background: #0a0a0a; overflow: hidden; }
.img-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
.img-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 11px; letter-spacing: 0.25em; color: #555; }

/* Landscape: image fills the top — full width, height auto via aspect, but we cap to 56% of square */
.img-stage--landscape .img-wrap { width: 100%; height: 60%; }
/* Portrait: fills the left — full height, width auto via aspect cap */
.img-stage--portrait .img-wrap { width: 60%; height: 100%; }
/* Square: fills entire stage */
.img-stage--square .img-wrap { width: 100%; height: 100%; }

/* LICENCE CARD */
.licence-card {
  position: absolute;
  z-index: 5;
  width: 380px;
  padding: 32px 28px 28px;
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  color: #e8e8e8;
  font-size: 13px;
  line-height: 1.5;
}
/* Dotted grey border via background-image so corners can also show ticks */
.licence-card {
  background-image:
    rgba(10,10,10,0.78),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 6px),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 6px);
}
.licence-card {
  /* layered: dotted border on edges */
  background:
    linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)) padding-box,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 6px) top/100% 1px no-repeat,
    repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 6px) bottom/100% 1px no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 6px) left/1px 100% no-repeat,
    repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 6px) right/1px 100% no-repeat,
    rgba(8,8,8,0.82);
}

/* Position by orientation */
.img-stage--landscape .licence-card { top: calc(60% + 40px); right: 40px; }
.img-stage--portrait .licence-card { top: 40px; right: 40px; }
.img-stage--square .licence-card { top: 40px; right: 40px; }

/* Decorative tick corners */
.lc-corner { position: absolute; width: 14px; height: 14px; }
.lc-corner--tl { top: -1px; left: -1px; border-top: 1px solid #D75F68; border-left: 1px solid #D75F68; }
.lc-corner--tr { top: -1px; right: -1px; border-top: 1px solid #D75F68; border-right: 1px solid #D75F68; }
.lc-corner--bl { bottom: -1px; left: -1px; border-bottom: 1px solid #D75F68; border-left: 1px solid #D75F68; }
.lc-corner--br { bottom: -1px; right: -1px; border-bottom: 1px solid #D75F68; border-right: 1px solid #D75F68; }

.lc-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #fff; margin-bottom: 14px; font-weight: 700; }
.lc-intro { font-size: 11px; line-height: 1.55; color: #a8a8a8; margin-bottom: 22px; }

.lc-tiers { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.08); margin-bottom: 20px; }
.lc-tier {
  all: unset; cursor: pointer;
  display: flex; gap: 12px; align-items: flex-start;
  padding: 14px 12px; background: rgba(20,20,20,0.9);
  transition: background 0.15s ease;
}
.lc-tier:hover { background: rgba(35,35,35,0.95); }
.lc-tier--active { background: rgba(50,50,50,0.95); }

.lc-radio { flex: 0 0 14px; width: 14px; height: 14px; border: 1px solid #888; border-radius: 50%; margin-top: 3px; position: relative; }
.lc-radio--on { border-color: #fff; }
.lc-radio--on::after { content: ""; position: absolute; inset: 2px; background: #fff; border-radius: 50%; }

.lc-tier-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.lc-tier-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.lc-tier-label { font-size: 13px; font-weight: 500; color: #f5f5f5; }
.lc-tier-price { font-size: 13px; font-weight: 600; color: #fff; font-variant-numeric: tabular-nums; }
.lc-tier-sub { font-size: 10px; color: #888; letter-spacing: 0.02em; }

.lc-freeze { padding: 14px 12px; background: rgba(20,20,20,0.6); margin-bottom: 20px; border-left: 2px solid #D75F68; }
.lc-freeze-title { font-size: 12px; color: #D75F68; font-weight: 600; margin-bottom: 4px; }
.lc-freeze-sub { font-size: 10px; color: #888; line-height: 1.5; }

.lc-total { display: flex; align-items: baseline; gap: 8px; justify-content: center; padding: 14px 0 18px; }
.lc-total-amount { font-size: 28px; font-weight: 300; color: #fff; font-variant-numeric: tabular-nums; }
.lc-total-currency { font-size: 11px; color: #888; letter-spacing: 0.2em; }

.lc-cta {
  all: unset; cursor: pointer; display: block; width: 100%;
  text-align: center; padding: 16px; background: #D75F68; color: #fff;
  font-size: 13px; font-weight: 600; letter-spacing: 0.2em;
  transition: background 0.2s ease;
}
.lc-cta:hover { background: #000; box-shadow: inset 0 0 0 1px #D75F68; }

/* META below the square */
.img-meta { position: absolute; left: 36px; right: 36px; top: calc(100vw + 40px); color: #ccc; }
.img-meta-num { font-size: 11px; letter-spacing: 0.25em; color: #666; margin-bottom: 8px; }
.img-meta-title { font-size: 22px; font-weight: 500; color: #fff; margin-bottom: 10px; max-width: 720px; }
.img-meta-caption { font-size: 13px; color: #999; max-width: 720px; line-height: 1.6; margin-bottom: 20px; }
.img-meta-kw { display: flex; flex-wrap: wrap; gap: 6px; }
.img-meta-kw span { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; background: rgba(255,255,255,0.05); color: #aaa; }

/* Push body to give meta room */
.img-root { padding-bottom: 200px; }

@media (max-width: 720px) {
  .licence-card { width: calc(100% - 32px); right: 16px; left: 16px; }
  .img-stage--landscape .licence-card { top: calc(60% + 16px); }
  .img-stage--portrait .img-wrap { width: 100%; height: 60%; }
  .img-stage--portrait .licence-card { top: calc(60% + 16px); }
}
`;
