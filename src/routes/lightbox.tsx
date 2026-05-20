import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, X, LayoutGrid, Rows3 } from "lucide-react";
import {
  getLightbox,
  removeFromLightbox,
  clearLightbox,
  subscribeLightbox,
} from "@/lib/lightbox";
import {
  getPublicImagesByIds,
  type PublicSearchResult,
} from "@/lib/search.functions";

export const Route = createFileRoute("/lightbox")({
  head: () => ({
    meta: [
      { title: "Lightbox — BEAUTYIMAGES" },
      { name: "description", content: "Your saved images for review." },
    ],
  }),
  component: LightboxPage,
});

function useLightboxIdsJson(): string {
  return useSyncExternalStore(
    subscribeLightbox,
    () => JSON.stringify(getLightbox()),
    () => "[]",
  );
}

function LightboxPage() {
  const idsJson = useLightboxIdsJson();
  const ids: string[] = JSON.parse(idsJson);
  const fetchImages = useServerFn(getPublicImagesByIds);
  const [items, setItems] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [masonry, setMasonry] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w <= 768) setCols(2);
      else if (w <= 900) setCols(3);
      else setCols(4);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    fetchImages({ data: { ids } })
      .then((r) => {
        if (!alive) return;
        setItems(r);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idsJson, fetchImages]);

  const handleClear = useCallback(() => setConfirmOpen(true), []);
  const confirmClear = useCallback(() => {
    clearLightbox();
    setConfirmOpen(false);
  }, []);

  const renderCard = (r: PublicSearchResult) => (
    <div key={r.id} className="search-result-card">
      <Link to="/image/$id" params={{ id: r.id }} className="src-link">
        {r.signed_url ? (
          <img src={r.signed_url} alt={r.title ?? r.caption ?? ""} loading="lazy" />
        ) : (
          <div className="search-result-fallback" />
        )}
      </Link>
      <button
        type="button"
        className="src-remove"
        aria-label="Remove from lightbox"
        onClick={() => removeFromLightbox(r.id)}
      >
        <X size={14} />
      </button>
      <figcaption>
        <div className="src-num">#{String(r.image_number).padStart(5, "0")}</div>
        {r.title && <div className="src-title">{r.title}</div>}
      </figcaption>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lb-root">
        <Link to="/" className="lb-back">← BACK TO SEARCH</Link>


        <div className="search-results">
          <div className="search-results-header">
            <div className="srh-text">
              LIGHTBOX
              <span className="srp-meta">
                {" "}
                · {ids.length} {ids.length === 1 ? "IMAGE" : "IMAGES"}
              </span>
            </div>
            {ids.length > 0 && (
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
                <button type="button" className="srh-lightbox" onClick={handleClear}>
                  <Trash2 size={16} />
                  <span>CLEAR</span>
                </button>
              </div>
            )}
          </div>

          {loading && <div className="search-results-status">LOADING…</div>}

          {!loading && ids.length === 0 && (
            <div className="search-results-status">
              YOUR LIGHTBOX IS EMPTY — ADD IMAGES FROM THE LIBRARY
            </div>
          )}

          {!loading && items.length > 0 && !masonry && (
            <div className="search-results-grid">
              {items.map((r) => renderCard(r))}
            </div>
          )}

          {!loading && items.length > 0 && masonry && (
            <div className="search-results-masonry">
              {Array.from({ length: cols }, (_, ci) => (
                <div className="masonry-col" key={ci}>
                  {items.filter((_, i) => i % cols === ci).map((r) => renderCard(r))}
                </div>
              ))}
            </div>
          )}
        </div>

        {confirmOpen && (
          <div className="lb-modal-backdrop" onClick={() => setConfirmOpen(false)}>
            <div
              className="lb-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="lb-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div id="lb-modal-title" className="lb-modal-title">CLEAR LIGHTBOX</div>
              <div className="lb-modal-body">
                Remove all {ids.length} {ids.length === 1 ? "image" : "images"} from your Lightbox? This can't be undone.
              </div>
              <div className="lb-modal-actions">
                <button type="button" className="lb-btn lb-btn--ghost" onClick={() => setConfirmOpen(false)}>
                  CANCEL
                </button>
                <button type="button" className="lb-btn lb-btn--danger" onClick={confirmClear}>
                  CLEAR ALL
                </button>
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

/* Match search-results styles from index.tsx */
.search-results { padding: 32px 40px 120px; }

.search-results-header {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: clamp(28px, 4.2vw, 56px);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.035em;
  line-height: 1.15;
  color: #000;
  margin-bottom: 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
.search-results-header .srh-text { flex: 1; min-width: 0; }
.srh-actions { display: inline-flex; align-items: center; gap: 10px; }
.search-results-header .srh-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  background: #fff; color: #111; border: 1px solid #111;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.search-results-header .srh-iconbtn:hover { background: #111; color: #fff; }
.search-results-header .srh-lightbox {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 14px; background: #fff; color: #111; border: 1px solid #111;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
  text-decoration: none; text-transform: uppercase; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.search-results-header .srh-lightbox:hover { background: #D75F68; color: #fff; border-color: #D75F68; }
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

/* Masonry: flex-based columns guarantee top-row alignment */
.search-results-masonry {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}
.masonry-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.search-results-masonry .search-result-card {
  display: block;
  margin: 0;
}
.search-results-masonry .search-result-card:hover { transform: none; }
.search-results-masonry .search-result-card img,
.search-results-masonry .search-result-fallback {
  width: 100%;
  height: auto;
  aspect-ratio: auto;
  object-fit: initial;
  display: block;
  background: #eee;
}
@media (max-width: 768px) {
  .search-results-masonry { gap: 14px; }
  .masonry-col { gap: 14px; }
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
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  background: #eee;
}
.search-result-card figcaption {
  padding: 10px 2px 0;
  display: flex; flex-direction: column; gap: 2px;
}
.search-result-card .src-num {
  font-size: 10px; letter-spacing: 0.25em; color: #999; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.search-result-card .src-title {
  font-size: 12px; color: #111; letter-spacing: 0.04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.src-remove {
  position: absolute; top: 8px; right: 8px;
  width: 28px; height: 28px; border: 0;
  background: rgba(0,0,0,0.6); color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.2s ease;
  z-index: 2;
}
.src-remove:hover { background: #D75F68; }

/* Custom modal */
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
.lb-modal-title {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: 32px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase;
  line-height: 1; margin-bottom: 14px;
}
.lb-modal-body {
  font-size: 13px; line-height: 1.5; color: #444; margin-bottom: 22px;
}
.lb-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.lb-btn {
  height: 38px; padding: 0 16px; border: 1px solid #111;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  cursor: pointer; transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.lb-btn--ghost { background: #fff; color: #111; }
.lb-btn--ghost:hover { background: #111; color: #fff; }
.lb-btn--danger { background: #111; color: #fff; }
.lb-btn--danger:hover { background: #D75F68; border-color: #D75F68; }

@media (max-width: 768px) {
  .lb-back { padding: 18px 22px 0; }
  .search-results { padding: 24px 22px 80px; }
  .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
}
`;
