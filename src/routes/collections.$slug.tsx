import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchPublicImages, type PublicSearchResult } from "@/lib/search.functions";
import { SITE_URL, SITE_NAME, getCollection, COLLECTIONS, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/collections/$slug")({
  loader: ({ params }) => {
    const collection = getCollection(params.slug);
    if (!collection) throw notFound();
    return { collection };
  },
  head: ({ params, loaderData }) => {
    const c = loaderData?.collection;
    if (!c) return { meta: [{ title: "Collection — Beauty Images" }] };
    const url = `${SITE_URL}/collections/${params.slug}`;
    return {
      meta: [
        { title: c.metaTitle },
        { name: "description", content: c.description },
        { property: "og:title", content: c.metaTitle },
        { property: "og:description", content: c.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: c.title,
            description: c.description,
            url,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbJsonLd([
              ["Home", "/"],
              ["Collections", "/collections"],
              [c.title, `/collections/${params.slug}`],
            ]),
          ),
        },
      ],
    };
  },
  component: CollectionPage,
  notFoundComponent: () => (
    <div style={{ padding: 80, textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#888" }}>Not found</p>
      <h1>Collection not found</h1>
      <p><Link to="/collections" style={{ color: "#D75F68" }}>← Browse all collections</Link></p>
    </div>
  ),
});

const CSS = `
.col { background: #fff; color: #111; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.col-top { padding: 26px 40px; border-bottom: 1px solid #ededed; display: flex; justify-content: space-between; align-items: center; }
.col-top a { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; }
.col-top a:hover { color: #D75F68; }
.col-doc { max-width: 1280px; margin: 0 auto; padding: 56px 24px 24px; }
.col-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #999; margin: 0 0 14px; font-weight: 700; }
.col-doc h1 { font-size: clamp(34px, 5.5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 16px; text-transform: uppercase; }
.col-intro { font-size: 16px; line-height: 1.7; color: #444; max-width: 740px; margin: 0 0 36px; }
.col-meta { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #888; margin: 0 0 24px; }
.col-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; padding: 0 24px 80px; max-width: 1280px; margin: 0 auto; }
.col-card { display: block; overflow: hidden; background: #f4f4f4; text-decoration: none; color: inherit; position: relative; aspect-ratio: 1 / 1; }
.col-card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
.col-card:hover img { transform: scale(1.03); }
.col-empty { padding: 40px 24px 80px; text-align: center; color: #888; font-size: 14px; }
.col-also { margin: 0 auto; max-width: 1280px; padding: 48px 24px 88px; border-top: 1px solid #ededed; }
.col-also h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin: 0 0 20px; }
.col-also-list { display: flex; flex-wrap: wrap; gap: 10px; }
.col-also-list a { font-size: 12px; padding: 8px 14px; border: 1px solid #e0e0e0; text-decoration: none; color: #333; }
.col-also-list a:hover { border-color: #111; color: #111; }
`;

function CollectionPage() {
  const { slug } = Route.useParams();
  const { collection } = Route.useLoaderData();
  const runSearch = useServerFn(searchPublicImages);
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    runSearch({ data: { q: collection.query, limit: 60, seed: 1 } })
      .then((r) => { if (alive) setResults(r); })
      .catch(() => { if (alive) setResults([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [collection.query, runSearch]);

  const others = COLLECTIONS.filter((c) => c.slug !== slug);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="col">
        <div className="col-top">
          <Link to="/">← Beauty Images</Link>
          <Link to="/collections">All collections</Link>
        </div>
        <div className="col-doc">
          <p className="col-eyebrow">Collection</p>
          <h1>{collection.title}</h1>
          <p className="col-intro">{collection.intro}</p>
          <p className="col-meta">
            {loading ? "Loading…" : `${results.length} ${results.length === 1 ? "image" : "images"} · Rights-managed · Real photography · No AI`}
          </p>
        </div>

        {results.length > 0 && (
          <div className="col-grid">
            {results.map((r) => (
              <Link
                key={r.id}
                to="/image/$id"
                params={{ id: r.id }}
                search={{ from: "search" }}
                className="col-card"
                aria-label={r.title ?? r.caption ?? `Beauty image #${r.image_number}`}
              >
                {r.signed_url && (
                  <img
                    src={r.signed_url}
                    alt={r.title ?? r.caption ?? `${collection.title} — rights-managed beauty photograph from ${SITE_NAME}`}
                    loading="lazy"
                  />
                )}
              </Link>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="col-empty">No images in this collection yet. <Link to="/collections" style={{ color: "#D75F68" }}>Browse other collections</Link>.</div>
        )}

        <section className="col-also">
          <h2>Browse more collections</h2>
          <div className="col-also-list">
            {others.map((c) => (
              <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }}>
                {c.title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
