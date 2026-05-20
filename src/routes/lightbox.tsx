import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Trash2 } from "lucide-react";
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

  const handleClear = useCallback(() => {
    if (window.confirm("Remove all images from your Lightbox?")) clearLightbox();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lb-root">
        <header className="lb-header">
          <Link to="/" className="lb-back">← BACK TO SEARCH</Link>
          <div className="lb-title-block">
            <div className="lb-eyebrow">YOUR LIGHTBOX</div>
            <h1 className="lb-title">
              {ids.length} {ids.length === 1 ? "IMAGE" : "IMAGES"} SAVED
            </h1>
            <p className="lb-sub">
              Sift through your selection. Remove anything you don't need, then
              click an image to review or purchase a licence.
            </p>
          </div>
          {ids.length > 0 && (
            <button type="button" className="lb-clear" onClick={handleClear}>
              <Trash2 size={14} />
              <span>CLEAR LIGHTBOX</span>
            </button>
          )}
        </header>

        {loading && <div className="lb-status">LOADING…</div>}

        {!loading && ids.length === 0 && (
          <div className="lb-empty">
            <div className="lb-empty-title">YOUR LIGHTBOX IS EMPTY</div>
            <p className="lb-empty-sub">
              Browse the library and click <strong>ADD TO LIGHTBOX</strong> on
              any image to save it here for review.
            </p>
            <Link to="/" className="lb-empty-cta">START BROWSING →</Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="lb-grid">
            {items.map((r) => (
              <div className="lb-card" key={r.id}>
                <Link
                  to="/image/$id"
                  params={{ id: r.id }}
                  className="lb-card-link"
                >
                  {r.signed_url ? (
                    <img src={r.signed_url} alt={r.title ?? r.caption ?? ""} loading="lazy" />
                  ) : (
                    <div className="lb-card-fallback" />
                  )}
                </Link>
                <button
                  type="button"
                  className="lb-card-remove"
                  aria-label="Remove from lightbox"
                  onClick={() => removeFromLightbox(r.id)}
                >
                  <X size={14} />
                </button>
                <figcaption>
                  <div className="lb-num">#{String(r.image_number).padStart(5, "0")}</div>
                  {r.title && <div className="lb-cap-title">{r.title}</div>}
                </figcaption>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const CSS = `
.lb-root { min-height: 100vh; background: #fff; color: #111; padding: 48px 36px 96px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.lb-root * { box-sizing: border-box; }

.lb-header { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 24px; margin-bottom: 48px; border-bottom: 1px solid #eee; padding-bottom: 24px; }
.lb-back { grid-column: 1 / -1; justify-self: start; background: none; border: 0; padding: 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; font-weight: 700; color: #111; text-decoration: none; margin-bottom: 24px; cursor: pointer; transition: color 0.2s ease; }
.lb-back:hover { color: #D75F68; }
.lb-title-block { min-width: 0; }
.lb-eyebrow { font-size: 11px; letter-spacing: 0.3em; color: #888; font-weight: 600; margin-bottom: 8px; }
.lb-title { font-size: 28px; font-weight: 500; letter-spacing: -0.01em; margin: 0 0 12px; }
.lb-sub { font-size: 13px; color: #555; max-width: 560px; line-height: 1.55; margin: 0; }

.lb-clear { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; color: #111; border: 1px solid #e0e0e0; font-size: 11px; letter-spacing: 0.2em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.lb-clear:hover { background: #111; color: #fff; border-color: #111; }

.lb-status { padding: 80px 0; text-align: center; font-size: 11px; letter-spacing: 0.3em; color: #999; }

.lb-empty { padding: 80px 0; text-align: center; }
.lb-empty-title { font-size: 13px; letter-spacing: 0.3em; color: #111; font-weight: 700; margin-bottom: 16px; }
.lb-empty-sub { font-size: 14px; color: #666; max-width: 460px; margin: 0 auto 32px; line-height: 1.6; }
.lb-empty-cta { display: inline-block; padding: 14px 32px; background: #D75F68; color: #fff; text-decoration: none; font-size: 12px; letter-spacing: 0.2em; font-weight: 600; transition: background 0.2s ease; }
.lb-empty-cta:hover { background: #111; }

.lb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.lb-card { position: relative; background: #f7f7f7; border: 1px solid #eee; }
.lb-card-link { display: block; }
.lb-card-link img { display: block; width: 100%; height: 240px; object-fit: cover; transition: opacity 0.2s ease; }
.lb-card-link:hover img { opacity: 0.92; }
.lb-card-fallback { width: 100%; height: 240px; background: #eee; }
.lb-card-remove { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; background: rgba(0,0,0,0.6); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s ease; }
.lb-card-remove:hover { background: #D75F68; }
.lb-card figcaption { padding: 10px 12px; }
.lb-num { font-size: 10px; letter-spacing: 0.25em; color: #888; font-weight: 600; margin-bottom: 4px; }
.lb-cap-title { font-size: 12px; color: #222; line-height: 1.4; }

@media (max-width: 600px) {
  .lb-root { padding: 24px 16px 64px; }
  .lb-header { grid-template-columns: 1fr; }
  .lb-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  .lb-card-link img, .lb-card-fallback { height: 180px; }
}
`;
