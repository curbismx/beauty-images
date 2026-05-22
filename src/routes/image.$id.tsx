import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useServerFn } from "@tanstack/react-start";
import {
  getPublicImage,
  getSimilarShootImages,
  type PublicImageDetail,
  type PublicSearchResult,
} from "@/lib/search.functions";
import {
  addToLightbox,
  removeFromLightbox,
  getLightbox,
  subscribeLightbox,
} from "@/lib/lightbox";
import {
  addToBasket,
  removeFromBasket,
  getBasket,
  subscribeBasket,
  type BasketItem,
} from "@/lib/basket";
import { useViewMode, useMasonryCols } from "@/lib/view-mode";
import { LayoutGrid, Rows3 } from "lucide-react";

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
    sub: "800 px max width",
    description:
      "A Small image delivers an image with maximum edge 800px as a JPG download. These images will be ideal for small usage on websites, social media, blog and small editorial usage. Digital rights will last for 12 months worldwide license.",
  },
  {
    id: "medium",
    label: "Medium",
    price: "£275.00",
    sub: "2000 px max width",
    description:
      "A Medium image delivers an image with maximum edge 2000px as a JPG download. These images will be suited to magazine spreads, brochures, packaging mock-ups and quarter-page print. Digital rights will last for 12 months worldwide license.",
  },
  {
    id: "large",
    label: "Large",
    price: "£375.00",
    sub: "5400 px max width",
    description:
      "A Large image delivers an image with maximum edge 5400px as a JPG download. These images will be suited to for full-page print, posters, billboards and high-end advertising campaigns. Digital rights will last for 12 months worldwide license.",
  },

];

function ImageDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchImage = useServerFn(getPublicImage);
  const [img, setImg] = useState<PublicImageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgReady, setImgReady] = useState(false);
  const [wmVariant, setWmVariant] = useState<
    "portrait" | "square" | "landscape" | null
  >(null);
  const [tier, setTier] = useState<TierId>("medium");
  const fetchSimilar = useServerFn(getSimilarShootImages);
  const [similar, setSimilar] = useState<PublicSearchResult[]>([]);
  const [viewMode, setViewMode] = useViewMode();
  const masonry = viewMode === "masonry";
  const cols = useMasonryCols();

  const lbJson = useSyncExternalStore(
    subscribeLightbox,
    () => JSON.stringify(getLightbox()),
    () => "[]",
  );
  const inLightbox = (JSON.parse(lbJson) as string[]).includes(id);

  const basketJson = useSyncExternalStore(
    subscribeBasket,
    () => JSON.stringify(getBasket()),
    () => "[]",
  );
  const inBasket = (JSON.parse(basketJson) as BasketItem[]).some(
    (x) => x.id === id && x.tier === tier,
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setImgReady(false);
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

  useEffect(() => {
    if (!img) return;
    let alive = true;
    fetchSimilar({ data: { excludeId: img.id, imageNumber: img.image_number } })
      .then((r) => alive && setSimilar(r))
      .catch(() => alive && setSimilar([]));
    return () => { alive = false; };
  }, [img, fetchSimilar]);

  const activeTier = TIERS.find((t) => t.id === tier)!;




  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="img-root">
        <header className={`img-header${imgReady ? " img-header--ready" : ""}`}>
          <div className="img-header-left">
            <button
              type="button"
              className="img-back"
              onClick={() => {
                try { sessionStorage.setItem("bi_restore_search", "1"); } catch { /* ignore */ }
                navigate({ to: "/" });
              }}
            >
              <svg className="img-back-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                <path d="M19 12H5M11 5l-7 7 7 7" />
              </svg>
              <span>BACK TO SEARCH RESULTS</span>
            </button>
            <button
              type="button"
              className="img-back img-back--home"
              onClick={() => {
                try { sessionStorage.removeItem("bi_restore_search"); sessionStorage.removeItem("bi_search_state"); } catch { /* ignore */ }
                navigate({ to: "/" });
              }}
            >
              / BACK TO HOME
            </button>
          </div>
          <nav className="img-header-right">
            <button
              type="button"
              className={`img-nav-link${inLightbox ? " img-nav-link--on" : ""}`}
              onClick={() => (inLightbox ? removeFromLightbox(id) : addToLightbox(id))}
            >
              {inLightbox ? "IN LIGHTBOX" : "ADD TO LIGHTBOX"}
            </button>
            <span className="img-nav-sep">/</span>
            <a className="img-nav-link" href="/lightbox">LIGHTBOX</a>
            <span className="img-nav-sep">/</span>
            <a className="img-nav-link" href="/basket">BASKET</a>
          </nav>
        </header>

        {/* Single column image + licence */}
        <section className="img-split">
          <div className="img-stage">
            <div className="img-stage-inner">
              <div className="img-frame">
                <div className="img-box">
                  {img?.signed_url ? (
                    <>
                      <img
                        className={`img-el${imgReady ? " img-el--ready" : ""}`}
                        src={img.signed_url}
                        alt={img.title ?? ""}
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                        onLoad={(e) => {
                          const el = e.currentTarget;
                          const aspect = el.naturalWidth / el.naturalHeight;
                          setWmVariant(
                            aspect < 0.9
                              ? "portrait"
                              : aspect > 1.1
                                ? "landscape"
                                : "square",
                          );
                          setImgReady(true);
                        }}
                      />
                      {imgReady && wmVariant && (
                        <img
                          className="wm-mark"
                          src={`/watermark_${wmVariant}.png`}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                        />
                      )}
                    </>
                  ) : (
                    <div className="img-empty">{loading ? "LOADING…" : "IMAGE UNAVAILABLE"}</div>
                  )}
                </div>
              </div>
              {imgReady && (
                <div className="lc-detail lc-detail--under">
                  <div className="lc-btn-row">
                    {TIERS.map((t) => {
                      const active = tier === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`lc-btn${active ? " lc-btn--active" : ""}`}
                          onClick={() => setTier(t.id)}
                        >
                          <span className="lc-btn-box">{t.label.charAt(0).toUpperCase()}</span>
                          <span className="lc-btn-price">{t.price}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`lc-btn lc-btn--cta${inBasket ? " lc-btn--cta-on" : ""}`}
                      onClick={() =>
                        inBasket ? removeFromBasket(id, tier) : addToBasket(id, tier)
                      }
                    >
                      <span className="lc-btn-label">
                        {inBasket ? "REMOVE FROM BASKET" : "ADD TO BASKET"}
                      </span>
                      <span className="lc-btn-price">{activeTier.price}</span>
                    </button>
                  </div>
                  <div className="lc-detail-eyebrow">LICENCE DETAILS</div>
                  <div className="lc-detail-head">
                    <span className="lc-detail-tier">{activeTier.label.toUpperCase()}</span>
                    <span className="lc-detail-price">{activeTier.price}</span>
                  </div>
                  <p className="lc-detail-text">{activeTier.description}</p>
                </div>
              )}
            </div>
          </div>
        </section>



        {/* WHITE DETAILS SECTION below the black stage */}
        {img && imgReady && (
          <section className="img-details">
            <div className="img-meta-num">#{String(img.image_number).padStart(8, "0")}</div>
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

        {img && imgReady && similar.length > 0 && (
          <section className="img-similar">
            <div className="search-results-header">
              <div className="srh-text">
                SIMILAR IMAGES
                <span className="srp-meta">
                  {" "}
                  · {similar.length} {similar.length === 1 ? "IMAGE" : "IMAGES"}
                </span>
              </div>
              <div className="srh-actions">
                <button
                  type="button"
                  className="srh-iconbtn"
                  aria-label={masonry ? "Show as square grid" : "Show full images (masonry)"}
                  title={masonry ? "Square grid" : "Masonry"}
                  onClick={() => setViewMode(masonry ? "square" : "masonry")}
                >
                  {masonry ? <LayoutGrid size={16} /> : <Rows3 size={16} />}
                </button>
              </div>
            </div>

            {!masonry && (
              <div className="search-results-grid">
                {similar.map((r) => renderSimCard(r))}
              </div>
            )}
            {masonry && (
              <div className="search-results-masonry">
                {Array.from({ length: cols }, (_, ci) => (
                  <div className="masonry-col" key={ci}>
                    {similar.filter((_, i) => i % cols === ci).map((r) => renderSimCard(r))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function renderSimCard(r: PublicSearchResult) {
  return (
    <Link
      key={r.id}
      to="/image/$id"
      params={{ id: r.id }}
      className="search-result-card"
    >
      {r.signed_url ? (
        <img src={r.signed_url} alt={r.title ?? r.caption ?? ""} loading="lazy" />
      ) : (
        <div className="search-result-fallback" />
      )}
      <figcaption>
        <div className="src-num">#{String(r.image_number).padStart(8, "0")}</div>
        {r.title && <div className="src-title">{r.title}</div>}
      </figcaption>
    </Link>
  );
}

const FRAME = 75;

const CSS = `
.img-root { background: #000; color: #e8e8e8; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.img-root * { box-sizing: border-box; }

.img-header { position: fixed; top: 0; left: 0; right: 0; z-index: 20; padding: 22px 36px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; gap: 24px; opacity: 0; transition: opacity 0.4s ease 0.05s; }
.img-header--ready { opacity: 1; }
.img-header-left { display: flex; align-items: center; gap: 14px; pointer-events: auto; }
.img-header-right { display: flex; align-items: center; gap: 10px; pointer-events: auto; }
.img-back { display: inline-flex; align-items: center; gap: 8px; background: none; border: 0; padding: 0; cursor: pointer; color: #fff; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; opacity: 0.85; transition: opacity 0.2s ease, color 0.2s ease; font-family: inherit; }
.img-back:hover { opacity: 1; color: #D75F68; }
.img-back-arrow { display: block; }
.img-back--home { opacity: 0.55; font-weight: 600; }
.img-back--home:hover { opacity: 1; }
.img-nav-link { color: #fff; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; text-decoration: none; opacity: 0.85; transition: opacity 0.2s ease, color 0.2s ease; }
.img-nav-link:hover { opacity: 1; color: #D75F68; }
.img-nav-sep { color: #fff; opacity: 0.45; font-size: 11px; }

/* Image stage (single column) */
.img-split {
  background: #000;
  padding: ${FRAME}px 0 15px;
}

.img-stage {
  background: #000;
  padding: 0 ${FRAME}px;
  min-width: 0;
}
.img-stage-inner {
  display: inline-block;
  max-width: 100%;
}

.img-frame {
  position: relative;
  display: block;
  max-width: 100%;
  font-size: 0;
}

.img-box {
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  position: relative;
  overflow: hidden;
}

.wm-mark {
  position: absolute;
  left: 50%;
  top: 60%;
  transform: translateY(-50%);
  height: 70px;
  width: auto;
  pointer-events: none;
  user-select: none;
}

.img-el {
  display: block;
  max-width: min(1000px, 100%);
  max-height: 700px;
  width: auto;
  height: auto;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.4s ease;
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.img-el--ready { opacity: 1; }

.img-empty {
  display: flex; align-items: center; justify-content: center;
  width: min(1000px, 100%); height: 400px;
  font-size: 11px; letter-spacing: 0.25em; color: #555;
  background: #0a0a0a;
}

/* Detail under image (left-aligned with image) */
.lc-detail { margin-bottom: 0; }
.lc-detail--under { margin: 75px 0 0; max-width: 100%; }
.lc-detail-eyebrow { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #888; font-weight: 700; margin: 28px 0 12px; }
.lc-detail-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 8px; }
.lc-detail-tier { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 0.2em; }
.lc-detail-price { font-size: 14px; font-weight: 600; color: #D75F68; font-variant-numeric: tabular-nums; letter-spacing: 0.05em; }
.lc-detail-text { font-size: 13px; line-height: 1.6; color: #e6e6e6; margin: 0; max-width: 66%; min-height: calc(1.6em * 5); }

.lc-btn-row {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 0;
}
.lc-btn {
  all: unset; cursor: pointer;
  display: inline-flex; align-items: stretch;
  height: 44px;
  border: 1px dashed rgba(255,255,255,0.2);
  background: transparent;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  overflow: hidden;
}
.lc-btn-box {
  display: flex; align-items: center; justify-content: center;
  width: 42px; height: 100%;
  background: rgba(255,255,255,0.08);
  font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: #fff;
  border-right: 1px dashed rgba(255,255,255,0.2);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.lc-btn-price {
  display: flex; align-items: center;
  padding: 0 16px;
  font-size: 13px; font-weight: 500; color: #fff;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.lc-btn-label {
  display: flex; align-items: center;
  padding: 0 16px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: #fff; white-space: nowrap;
}
.lc-btn:hover { background: #e8e8e8; border-color: #e8e8e8; border-style: solid; }
.lc-btn:hover .lc-btn-box { background: #d4d4d4; color: #000; border-right-color: #b8b8b8; border-right-style: solid; }
.lc-btn:hover .lc-btn-price,
.lc-btn:hover .lc-btn-label { color: #000; }
.lc-btn--active { border-color: rgba(255,255,255,0.55); border-style: solid; }

.lc-btn--cta { border-color: #D75F68; }
.lc-btn--cta:hover { background: rgba(215,95,104,0.12); border-color: #D75F68; border-style: dashed; }
.lc-btn--cta .lc-btn-box { background: rgba(215,95,104,0.18); color: #D75F68; border-right-color: rgba(215,95,104,0.45); }
.lc-btn--cta:hover .lc-btn-box { background: rgba(215,95,104,0.25); color: #D75F68; border-right-style: dashed; border-right-color: rgba(215,95,104,0.45); }
.lc-btn--cta .lc-btn-label,
.lc-btn--cta:hover .lc-btn-label { color: #D75F68; }
.lc-btn--cta .lc-btn-price,
.lc-btn--cta:hover .lc-btn-price { color: #D75F68; }

.lc-btn--cta-on { background: #D75F68; border-color: #D75F68; border-style: solid; }
.lc-btn--cta-on .lc-btn-box { background: rgba(0,0,0,0.18); color: #fff; border-right-color: rgba(255,255,255,0.3); border-right-style: solid; }
.lc-btn--cta-on .lc-btn-label,
.lc-btn--cta-on .lc-btn-price { color: #fff; }
.lc-btn--cta-on:hover { background: #b94e56; border-color: #b94e56; }
.lc-btn--cta-on:hover .lc-btn-box { background: rgba(0,0,0,0.22); color: #fff; }
.lc-btn--cta-on:hover .lc-btn-label,
.lc-btn--cta-on:hover .lc-btn-price { color: #fff; }

.img-nav-link {
  background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit;
}
.img-nav-link--on { color: #D75F68; }





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
  .img-stage { padding: 0 60px; }
  .img-el { max-height: calc(100vh - 120px); }
  .img-details { padding: 48px 32px 80px; }
  .img-meta-title { font-size: 24px; }
}
@media (max-width: 600px) {
  .img-stage { padding: 0 24px; }
  .img-el { max-height: calc(100vh - 100px); }
  
}

/* Similar images section — matches search results / lightbox styling */
.img-similar { background: #fff; color: #111; padding: 60px 40px 120px; }
.img-similar .search-results-header {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: clamp(28px, 4.2vw, 56px);
  font-weight: 900; text-transform: uppercase;
  letter-spacing: -0.035em; line-height: 1.15; color: #000;
  margin-bottom: 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
.img-similar .srh-text { flex: 1; min-width: 0; }
.img-similar .srp-meta { color: #999; font-weight: 900; }
.img-similar .srh-actions { display: inline-flex; align-items: center; gap: 10px; }
.img-similar .srh-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  background: #fff; color: #111; border: 1px solid #111; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.img-similar .srh-iconbtn:hover { background: #111; color: #fff; }
.img-similar .search-results-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px;
}
.img-similar .search-result-card {
  display: flex; flex-direction: column; background: #fafafa;
  text-decoration: none; color: inherit; cursor: pointer;
  transition: transform 0.25s ease;
}
.img-similar .search-result-card:hover { transform: translateY(-2px); }
.img-similar .search-result-card img,
.img-similar .search-result-fallback {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: #eee;
}
.img-similar .search-result-card figcaption {
  padding: 10px 2px 0; display: flex; flex-direction: column; gap: 2px;
}
.img-similar .src-num {
  font-size: 10px; letter-spacing: 0.25em; color: #999; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.img-similar .src-title {
  font-size: 12px; color: #111; letter-spacing: 0.04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.img-similar .search-results-masonry {
  display: flex; align-items: flex-start; gap: 24px;
}
.img-similar .masonry-col {
  flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 24px;
}
.img-similar .search-results-masonry .search-result-card { display: block; margin: 0; }
.img-similar .search-results-masonry .search-result-card:hover { transform: none; }
.img-similar .search-results-masonry .search-result-card img,
.img-similar .search-results-masonry .search-result-fallback {
  width: 100%; height: auto; aspect-ratio: auto; object-fit: initial;
  display: block; background: #eee;
}
@media (max-width: 768px) {
  .img-similar { padding: 36px 22px 80px; }
  .img-similar .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .img-similar .search-results-masonry { gap: 14px; }
  .img-similar .masonry-col { gap: 14px; }
}
`;
