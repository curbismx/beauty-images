import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/licence")({
  head: () => ({
    meta: [
      { title: "Licence Agreement — Beauty Images" },
      { name: "description", content: "The terms governing the rights-managed licensing of images from Beauty Images." },
    ],
  }),
  component: LicencePage,
});

const LEGAL_CSS = `
.legal { background: #fff; color: #1a1a1a; min-height: 100vh; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.legal-top { padding: 26px 40px; border-bottom: 1px solid #ededed; }
.legal-back { font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #111; text-decoration: none; transition: color 0.15s ease; }
.legal-back:hover { color: #D75F68; }
.legal-doc { max-width: 760px; margin: 0 auto; padding: 56px 24px 72px; }
.legal-doc h1 { font-size: clamp(30px, 5vw, 46px); font-weight: 900; letter-spacing: -0.03em; text-transform: uppercase; line-height: 1; margin: 0 0 8px; color: #111; }
.legal-updated { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #999; margin: 0 0 40px; }
.legal-doc h2 { font-size: 14px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin: 38px 0 12px; color: #111; }
.legal-doc p { font-size: 15px; line-height: 1.75; color: #3a3a3a; margin: 0 0 14px; }
.legal-doc ul { margin: 0 0 14px; padding-left: 20px; }
.legal-doc li { font-size: 15px; line-height: 1.7; color: #3a3a3a; margin-bottom: 8px; }
.legal-doc a { color: #D75F68; }
.legal-foot { max-width: 760px; margin: 0 auto; padding: 0 24px 64px; display: flex; gap: 20px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
.legal-foot a { color: #111; text-decoration: none; transition: color 0.15s ease; }
.legal-foot a:hover { color: #D75F68; }
@media (max-width: 768px) {
  .legal-top { padding: 20px 22px; }
  .legal-doc { padding: 40px 22px 56px; }
  .legal-foot { padding: 0 22px 48px; }
}
`;

function LicencePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <div className="legal">
        <header className="legal-top">
          <Link to="/" className="legal-back">← Beauty Images</Link>
        </header>
        <main className="legal-doc">
          <h1>Licence Agreement</h1>
          <p className="legal-updated">Last updated: [insert date]</p>

          <p>
            This Licence Agreement ("Agreement") governs the licensing and use of images supplied
            by The Beauty Images ("Beauty Images", "we", "us"). By purchasing a licence or
            downloading an image from us, you ("the Licensee", "you") agree to these terms. If you
            are entering into this Agreement on behalf of a company or organisation, you confirm
            that you have authority to bind it.
          </p>

          <h2>1. Our images are rights-managed</h2>
          <p>
            All images licensed by Beauty Images are licensed on a rights-managed basis. We do not
            offer royalty-free licences.
          </p>
          <p>
            Under a royalty-free model, an image is typically licensed once for a broad range of
            uses with few restrictions. A rights-managed licence is different: it grants permission
            to use a specific image for a specific use — defined by factors such as the media,
            size, placement, duration and territory — and the licence fee reflects that defined
            use. A rights-managed licence does not give you unlimited or perpetual rights to an
            image.
          </p>
          <p>
            If your intended use changes, or you wish to use an image beyond the scope of the
            licence you purchased, you must obtain a new or extended licence from us before doing
            so.
          </p>

          <h2>2. Definitions</h2>
          <p>
            "Image" means any photograph or visual content made available by Beauty Images.
            "Licence" means the permission to use an Image granted under this Agreement and the
            specific purchase you make. "Preview" or "comp" means a watermarked or low-resolution
            version of an Image provided for evaluation only.
          </p>

          <h2>3. Grant of licence</h2>
          <p>
            Subject to full payment and to the terms of this Agreement, we grant you a
            non-exclusive, non-transferable licence to use the licensed Image for the use
            associated with the licence tier you purchase. The licence takes effect once payment
            is complete and the Image has been delivered to you.
          </p>

          <h2>4. Licence tiers</h2>
          <p>
            We offer Small, Medium and Large licence tiers. The tier determines the maximum
            resolution of the file supplied and the scale of use permitted. You are responsible
            for selecting a tier appropriate to your intended use; details of each tier are shown
            at the point of purchase. If you are unsure which tier you need, contact us before
            purchasing.
          </p>

          <h2>5. Restrictions</h2>
          <p>Except as expressly permitted by your licence, you may not:</p>
          <ul>
            <li>
              resell, sub-license, rent, lend or otherwise transfer an Image or your licence to
              any third party;
            </li>
            <li>
              make an Image available for download or redistribution, or incorporate it into any
              product where the primary value of that product is the Image itself;
            </li>
            <li>
              use an Image in a way that is unlawful, defamatory or obscene, or that infringes the
              rights of any person;
            </li>
            <li>
              use an Image in a pornographic or unflattering context in connection with an
              identifiable person;
            </li>
            <li>
              suggest that a person, brand or product shown in an Image endorses any product,
              service or opinion, unless the necessary releases are held;
            </li>
            <li>
              alter an Image and claim the result as your own original work, or represent an Image
              as having been generated by artificial intelligence; or
            </li>
            <li>remove or obscure any copyright or attribution information.</li>
          </ul>

          <h2>6. Editorial and commercial use; releases</h2>
          <p>
            Some Images are suitable for commercial use and some for editorial use only. Unless we
            confirm in writing that the necessary model and property releases are held, an Image
            must be used for editorial purposes only and not to advertise or promote any product,
            service or organisation. You are responsible for ensuring you hold the rights and
            permissions required for your intended use.
          </p>

          <h2>7. Preview and comp images</h2>
          <p>
            Preview and comp images are provided so that you can evaluate an Image before
            licensing it. They may be used only for internal review, layout and pitching purposes
            and must not be used in any final or published material. Final use requires a paid
            licence and a delivered, licensed file.
          </p>

          <h2>8. Ownership and intellectual property</h2>
          <p>
            All Images, and all intellectual property rights in them, remain the property of
            Beauty Images or its photographers. This Agreement licenses the use of an Image; it
            does not transfer ownership or copyright. All of our Images feature real people and
            real photography.
          </p>

          <h2>9. Payment and refunds</h2>
          <p>
            Licence fees are payable in full at the time of purchase. Because licences are
            delivered as digital files, all sales are final and licence fees are non-refundable
            once an Image has been delivered, except where required by law or where we agree
            otherwise in writing.
          </p>

          <h2>10. Term and termination</h2>
          <p>
            A licence continues for the use, and any duration, specified at the point of purchase.
            We may terminate a licence if you breach this Agreement. On termination you must stop
            using the affected Image and, where reasonably possible, remove it from any material
            under your control. Termination for breach does not entitle you to a refund.
          </p>

          <h2>11. Warranties and disclaimers</h2>
          <p>
            We supply Images with reasonable care. Except as expressly stated in this Agreement,
            Images are provided "as is" and we make no other warranties, whether express or
            implied. We do not warrant that an Image is suitable for a particular purpose;
            selecting an appropriate Image and licence for your use is your responsibility.
          </p>

          <h2>12. Limitation of liability</h2>
          <p>
            Nothing in this Agreement limits liability that cannot be limited by law. Subject to
            that, our total liability to you in connection with a licensed Image will not exceed
            the licence fee you paid for that Image, and we are not liable for any indirect or
            consequential loss.
          </p>

          <h2>13. Indemnity</h2>
          <p>
            You agree to indemnify Beauty Images against claims, losses and costs arising from
            your use of an Image outside the scope of your licence or otherwise in breach of this
            Agreement.
          </p>

          <h2>14. Governing law</h2>
          <p>
            This Agreement is governed by the laws of England and Wales, and the courts of England
            and Wales have exclusive jurisdiction over any dispute arising from it.
          </p>

          <h2>15. Contact us</h2>
          <p>
            For licensing questions, to extend a licence, or to discuss a use not covered above,
            contact us at [insert contact email].
          </p>
        </main>
        <nav className="legal-foot">
          <Link to="/">Home</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </nav>
      </div>
    </>
  );
}
