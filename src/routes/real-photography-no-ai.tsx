import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd } from "@/lib/seo";

const URL = `${SITE_URL}/real-photography-no-ai`;
const TITLE = "Real Photography, No AI — Beauty Images";
const DESC =
  "Every image at Beauty Images is shot with real photographers and real subjects. None of our beauty photography is AI-generated. An AI-free, authentic image library for advertising and editorial buyers.";

export const Route = createFileRoute("/real-photography-no-ai")({
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
          "@type": "WebPage",
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
            ["Real Photography, No AI", "/real-photography-no-ai"],
          ]),
        ),
      },
    ],
  }),
  component: NoAIPage,
});

const CSS = `
.noai { background: #fff; color: #111; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.noai-top { padding: 26px 40px; border-bottom: 1px solid #ededed; }
.noai-back { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; }
.noai-back:hover { color: #D75F68; }
.noai-hero { background: #111; color: #fff; padding: 100px 24px 96px; text-align: center; }
.noai-hero-inner { max-width: 760px; margin: 0 auto; }
.noai-eyebrow { font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #D75F68; margin: 0 0 18px; font-weight: 800; }
.noai-hero h1 { font-size: clamp(40px, 7vw, 72px); font-weight: 900; letter-spacing: -0.04em; line-height: 0.98; margin: 0; text-transform: uppercase; }
.noai-hero h1 span { color: #D75F68; }
.noai-hero p { font-size: 17px; line-height: 1.65; color: #ccc; margin: 28px auto 0; max-width: 580px; }
.noai-doc { max-width: 760px; margin: 0 auto; padding: 64px 24px 88px; }
.noai-doc h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin: 40px 0 14px; }
.noai-doc h2:first-child { margin-top: 0; }
.noai-doc p { font-size: 16px; line-height: 1.75; color: #333; margin: 0 0 18px; }
.noai-doc a { color: #D75F68; }
.noai-promise { border: 2px solid #111; padding: 28px 24px; margin: 32px 0; }
.noai-promise strong { display: block; font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 12px; }
.noai-cta { margin-top: 48px; display: flex; gap: 14px; flex-wrap: wrap; }
.noai-btn { display: inline-flex; align-items: center; padding: 14px 22px; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; border: 1px solid #111; text-decoration: none; }
.noai-btn--solid { background: #111; color: #fff; }
.noai-btn--solid:hover { background: #D75F68; border-color: #D75F68; }
.noai-btn--ghost { color: #111; background: #fff; }
.noai-btn--ghost:hover { background: #111; color: #fff; }
`;

function NoAIPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="noai">
        <div className="noai-top"><Link to="/" className="noai-back">← Beauty Images</Link></div>
        <section className="noai-hero">
          <div className="noai-hero-inner">
            <p className="noai-eyebrow">Our Guarantee</p>
            <h1>Real photography. <span>No AI.</span></h1>
            <p>
              Every image at {SITE_NAME} is shot with real photographers and real subjects.
              None of our beauty photography is AI-generated.
            </p>
          </div>
        </section>

        <article className="noai-doc">
          <h2>The guarantee</h2>
          <div className="noai-promise">
            <strong>What we promise</strong>
            <p style={{ margin: 0 }}>
              No image in the {SITE_NAME} library is generated, in whole or in part, by AI. Every photograph in the
              collection was made by a human photographer working with real subjects, real make-up, real hair, real
              skin, real light. This is verifiable: every image has named creators and provenance.
            </p>
          </div>

          <h2>Why it matters now</h2>
          <p>
            AI-generated imagery is flooding the mass-market stock platforms. For advertising and editorial buyers,
            that creates three real problems: creative integrity (audiences increasingly spot synthetic imagery and
            penalise the brand for it); brand trust (claims of authenticity are only credible when the underlying
            image really is authentic); and compliance, as more jurisdictions, broadcasters and publishers introduce
            disclosure rules around AI-generated content.
          </p>

          <h2>An authentic, AI-free image library</h2>
          <p>
            Beauty Images is, by design, an AI-free stock photography library. It is a curated, exclusive, rights-managed
            collection of real beauty photography — skin, complexion, make-up, hair, fragrance, grooming and close-up
            beauty portraiture — for buyers who need provably human-made images.
          </p>

          <h2>Use it freely in your campaign or feature</h2>
          <p>
            Because every image is shot with real people, you can use Beauty Images photography in contexts where AI
            imagery would be inappropriate — cosmetics campaigns making authenticity claims, magazine beauty pages,
            advertorials, brand work where provenance matters.
          </p>

          <div className="noai-cta">
            <Link to="/collections" className="noai-btn noai-btn--solid">Browse real beauty photography</Link>
            <Link to="/licensing" className="noai-btn noai-btn--ghost">How licensing works</Link>
          </div>
        </article>
      </div>
    </>
  );
}
