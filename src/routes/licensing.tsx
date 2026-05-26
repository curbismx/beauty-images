import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL, SITE_NAME, breadcrumbJsonLd } from "@/lib/seo";

const URL = `${SITE_URL}/licensing`;
const TITLE = "Image Licensing — How Rights-Managed Beauty Image Licences Work | Beauty Images";
const DESC =
  "Licence rights-managed beauty photography directly from Beauty Images. Small, Medium and Large tiers, worldwide 12-month digital rights, simple online checkout for advertising and editorial buyers.";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is a rights-managed licence?",
    a: "A rights-managed licence grants you specific usage for an image — covering medium, market, duration and territory. Unlike royalty-free stock, rights-managed pricing reflects the use itself, and protects the image's commercial value for everyone who licenses it.",
  },
  {
    q: "What do the Small, Medium and Large licences cover?",
    a: "Small (800px max edge) suits websites, social media, blogs and small editorial use. Medium (2000px max edge) suits magazine spreads, brochures, packaging mock-ups and quarter-page print. Large (highest available resolution) suits full-page print, posters, billboards and high-end advertising campaigns. All three include a 12-month worldwide digital licence.",
  },
  {
    q: "Is every image really exclusive to Beauty Images?",
    a: "Yes. Every image in the library was shot exclusively for Beauty Images and is not available on any royalty-free or mass-market stock site. This is what protects its value for the buyers who licence it.",
  },
  {
    q: "Are any of the images AI-generated?",
    a: "No. Every photograph is shot with real photographers and real subjects. We do not use AI to generate or composite any image in the library.",
  },
  {
    q: "How do I licence an image?",
    a: "Find the image you want, choose Small, Medium or Large, add it to your basket and check out online. You can also contact us for custom usage briefs or bulk requests.",
  },
];

export const Route = createFileRoute("/licensing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Licence Beauty Photography — Beauty Images" },
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
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbJsonLd([
            ["Home", "/"],
            ["Licensing", "/licensing"],
          ]),
        ),
      },
    ],
  }),
  component: LicensingPage,
});

const CSS = `
.lic { background: #fff; color: #111; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.lic-top { padding: 26px 40px; border-bottom: 1px solid #ededed; }
.lic-back { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; }
.lic-back:hover { color: #D75F68; }
.lic-doc { max-width: 820px; margin: 0 auto; padding: 64px 24px 88px; }
.lic-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #999; margin: 0 0 14px; font-weight: 700; }
.lic-doc h1 { font-size: clamp(34px, 5.5vw, 52px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 18px; text-transform: uppercase; }
.lic-lede { font-size: 17px; line-height: 1.65; color: #444; margin: 0 0 40px; }
.lic-tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin: 32px 0 48px; }
.lic-tier { border: 1px solid #e8e8e8; padding: 22px 20px; }
.lic-tier h3 { margin: 0 0 4px; font-size: 14px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
.lic-tier .lic-tier-sub { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #999; margin: 0 0 14px; font-weight: 700; }
.lic-tier p { font-size: 14px; line-height: 1.65; color: #333; margin: 0; }
.lic-doc h2 { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; margin: 48px 0 14px; }
.lic-doc p { font-size: 16px; line-height: 1.75; color: #333; margin: 0 0 18px; }
.lic-doc a { color: #D75F68; }
.lic-faq { margin-top: 24px; }
.lic-faq dt { font-size: 15px; font-weight: 800; margin-top: 22px; color: #111; }
.lic-faq dd { font-size: 15px; line-height: 1.7; color: #333; margin: 6px 0 0; }
.lic-cta { margin-top: 56px; display: flex; gap: 14px; flex-wrap: wrap; }
.lic-btn { display: inline-flex; align-items: center; padding: 14px 22px; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; border: 1px solid #111; text-decoration: none; }
.lic-btn--solid { background: #111; color: #fff; }
.lic-btn--solid:hover { background: #D75F68; border-color: #D75F68; }
.lic-btn--ghost { color: #111; background: #fff; }
.lic-btn--ghost:hover { background: #111; color: #fff; }
`;

function LicensingPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lic">
        <div className="lic-top"><Link to="/" className="lic-back">← Beauty Images</Link></div>
        <article className="lic-doc">
          <p className="lic-eyebrow">Licensing</p>
          <h1>Licence beauty photography directly online.</h1>
          <p className="lic-lede">
            Every image at {SITE_NAME} is exclusive, rights-managed, and licensed directly through this site. Three
            licence tiers cover web, print and high-end campaign use, all with a 12-month worldwide digital licence
            as standard.
          </p>

          <div className="lic-tiers">
            <div className="lic-tier">
              <h3>Small</h3>
              <p className="lic-tier-sub">800 px max edge</p>
              <p>Websites, social media, blogs and small editorial use. JPG download, 12-month worldwide digital licence.</p>
            </div>
            <div className="lic-tier">
              <h3>Medium</h3>
              <p className="lic-tier-sub">2000 px max edge</p>
              <p>Magazine spreads, brochures, packaging mock-ups, quarter-page print. JPG download, 12-month worldwide digital licence.</p>
            </div>
            <div className="lic-tier">
              <h3>Large</h3>
              <p className="lic-tier-sub">Highest resolution</p>
              <p>Full-page print, posters, billboards, high-end advertising campaigns. JPG download, 12-month worldwide digital licence.</p>
            </div>
          </div>

          <h2>How a Beauty Images licence is different</h2>
          <p>
            Because every image is exclusive to {SITE_NAME}, you can use it knowing that it has not been licensed
            royalty-free across the wider internet. That exclusivity is what makes a rights-managed image worth
            licensing in the first place — for cosmetics campaigns, beauty pages, advertorials and any context where
            the image needs to feel uniquely yours.
          </p>

          <h2>For custom usage, exclusivity or full buy-outs</h2>
          <p>
            Need a longer term, a wider territory, an extension into out-of-home or a custom buy-out?{" "}
            <Link to="/contact">Get in touch</Link> and we will quote on the specific usage.
          </p>

          <h2>Frequently asked questions</h2>
          <dl className="lic-faq">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>

          <p style={{ marginTop: 32, fontSize: 13, color: "#777" }}>
            The full legal terms are on the <Link to="/licence">Licence Agreement</Link> page.
          </p>

          <div className="lic-cta">
            <Link to="/collections" className="lic-btn lic-btn--solid">Browse the library</Link>
            <Link to="/contact" className="lic-btn lic-btn--ghost">Custom brief</Link>
          </div>
        </article>
      </div>
    </>
  );
}
