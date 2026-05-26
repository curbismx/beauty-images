import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, SITE_NAME, COLLECTIONS, breadcrumbJsonLd } from "@/lib/seo";

const URL = `${SITE_URL}/collections`;
const TITLE = "Beauty Photography Collections — Beauty Images";
const DESC =
  "Curated collections of exclusive, rights-managed beauty photography — skin, make-up, hair, fragrance, men's grooming, fashion beauty, editorial portraits. All real photography, never AI.";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: TITLE,
          description: DESC,
          url: URL,
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          hasPart: COLLECTIONS.map((c) => ({
            "@type": "CollectionPage",
            name: c.title,
            url: `${SITE_URL}/collections/${c.slug}`,
            description: c.description,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbJsonLd([
            ["Home", "/"],
            ["Collections", "/collections"],
          ]),
        ),
      },
    ],
  }),
  component: CollectionsPage,
});

const CSS = `
.cols { background: #fff; color: #111; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.cols-top { padding: 26px 40px; border-bottom: 1px solid #ededed; }
.cols-back { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; }
.cols-back:hover { color: #D75F68; }
.cols-doc { max-width: 1100px; margin: 0 auto; padding: 64px 24px 88px; }
.cols-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #999; margin: 0 0 14px; font-weight: 700; }
.cols-doc h1 { font-size: clamp(34px, 5.5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 16px; text-transform: uppercase; }
.cols-lede { font-size: 17px; line-height: 1.65; color: #444; margin: 0 0 48px; max-width: 720px; }
.cols-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
.cols-card { display: block; padding: 28px 22px; border: 1px solid #e8e8e8; text-decoration: none; color: inherit; transition: border-color .15s ease, transform .15s ease; }
.cols-card:hover { border-color: #111; transform: translateY(-2px); }
.cols-card h2 { margin: 0 0 10px; font-size: 16px; font-weight: 800; letter-spacing: 0.04em; color: #111; }
.cols-card p { margin: 0; font-size: 13px; line-height: 1.6; color: #555; }
.cols-card .cols-card-cta { margin-top: 14px; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: #D75F68; font-weight: 800; }
`;

function CollectionsPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cols">
        <div className="cols-top"><Link to="/" className="cols-back">← Beauty Images</Link></div>
        <div className="cols-doc">
          <p className="cols-eyebrow">Collections</p>
          <h1>Curated beauty photography collections.</h1>
          <p className="cols-lede">
            Browse the {SITE_NAME} library by subject. Every collection is hand-picked, exclusive, rights-managed,
            and shot with real people — never AI-generated.
          </p>
          <div className="cols-grid">
            {COLLECTIONS.map((c) => (
              <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }} className="cols-card">
                <h2>{c.title}</h2>
                <p>{c.description}</p>
                <div className="cols-card-cta">View collection →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
