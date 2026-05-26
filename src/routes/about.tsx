import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd } from "@/lib/seo";

const URL = `${SITE_URL}/about`;
const TITLE = "About Beauty Images — Exclusive Rights-Managed Beauty Photography";
const DESC =
  "Beauty Images has supplied beauty photography to advertising and editorial buyers for over 20 years. Every image is exclusive, rights-managed and shot with real people — never AI.";

export const Route = createFileRoute("/about")({
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
          "@type": "AboutPage",
          name: TITLE,
          description: DESC,
          url: URL,
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbJsonLd([
            ["Home", "/"],
            ["About", "/about"],
          ]),
        ),
      },
    ],
  }),
  component: AboutPage,
});

const CSS = `
.about { background: #fff; color: #111; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.about-top { padding: 26px 40px; border-bottom: 1px solid #ededed; }
.about-back { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; }
.about-back:hover { color: #D75F68; }
.about-doc { max-width: 760px; margin: 0 auto; padding: 64px 24px 88px; }
.about-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #999; margin: 0 0 14px; font-weight: 700; }
.about-doc h1 { font-size: clamp(34px, 5.5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 24px; text-transform: uppercase; }
.about-doc h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin: 48px 0 14px; }
.about-doc p { font-size: 16px; line-height: 1.75; color: #333; margin: 0 0 18px; }
.about-doc a { color: #D75F68; }
.about-cta { margin-top: 56px; display: flex; gap: 14px; flex-wrap: wrap; }
.about-btn { display: inline-flex; align-items: center; padding: 14px 22px; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; border: 1px solid #111; text-decoration: none; transition: background .15s ease, color .15s ease; }
.about-btn--solid { background: #111; color: #fff; }
.about-btn--solid:hover { background: #D75F68; border-color: #D75F68; }
.about-btn--ghost { color: #111; background: #fff; }
.about-btn--ghost:hover { background: #111; color: #fff; }
`;

function AboutPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="about">
        <div className="about-top"><Link to="/" className="about-back">← Beauty Images</Link></div>
        <article className="about-doc">
          <p className="about-eyebrow">About</p>
          <h1>Exclusive beauty photography for advertising and editorial.</h1>

          <p>
            Beauty Images is a curated, rights-managed photography library specialising in beauty imagery for the
            advertising and editorial industries. We have supplied high-end publications and advertising campaigns for
            over twenty years.
          </p>

          <h2>Exclusive, not stock</h2>
          <p>
            Every image in the collection is exclusive to Beauty Images. Our library is hand-picked rather than
            crowd-sourced, and our pictures are licensed to professional buyers on a rights-managed basis — never sold
            royalty-free. An image's commercial value depends on who else is permitted to use it, and we take that
            seriously.
          </p>

          <h2>Real people, real photography, no AI</h2>
          <p>
            Every photograph in the library is made with real photographers and real subjects. None of our images are
            AI-generated, in whole or in part. As synthetic imagery floods the wider stock market, this guarantee
            matters more to advertising and editorial buyers each year — for creative integrity, for brand trust, and
            increasingly for compliance. Read more about{" "}
            <Link to="/real-photography-no-ai">our no-AI guarantee</Link>.
          </p>

          <h2>Licensing made simple</h2>
          <p>
            Images are licensed directly through this site on a tiered basis — Small, Medium and Large — covering the
            usage you actually need, with a 12-month worldwide digital licence as standard. See{" "}
            <Link to="/licensing">how licensing works</Link> for the full picture.
          </p>

          <h2>Who we work with</h2>
          <p>
            Advertising agency art buyers and art directors, and editorial picture editors and art buyers at beauty,
            fashion and lifestyle publications. Every image in the library is chosen with that audience in mind.
          </p>

          <div className="about-cta">
            <Link to="/collections" className="about-btn about-btn--solid">Browse collections</Link>
            <Link to="/contact" className="about-btn about-btn--ghost">Contact us</Link>
          </div>
        </article>
      </div>
    </>
  );
}
