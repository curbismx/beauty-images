import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Beauty Images" },
      { name: "description", content: "How Beauty Images collects, uses and protects your personal information." },
    ],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LEGAL_CSS }} />
      <div className="legal">
        <header className="legal-top">
          <Link to="/" className="legal-back">← Beauty Images</Link>
        </header>
        <main className="legal-doc">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: [insert date]</p>

          <p>
            This Privacy Policy explains how The Beauty Images ("Beauty Images", "we", "us")
            collects, uses and protects personal information when you visit our website and use
            our services. We are committed to handling your information responsibly and in
            accordance with the UK General Data Protection Regulation (UK GDPR) and the Data
            Protection Act 2018. If you have any questions about this policy, contact us at
            [insert contact email].
          </p>

          <h2>1. Who we are</h2>
          <p>
            Beauty Images is a rights-managed image licensing business based in the United
            Kingdom. For the purposes of data protection law, Beauty Images is the data
            controller responsible for your personal information. Our registered address is
            [insert company address].
          </p>

          <h2>2. Information we collect</h2>
          <p>We collect the following categories of information:</p>
          <ul>
            <li>
              Account information — when you create an account we collect your name, email
              address and an encrypted password.
            </li>
            <li>
              Order and licensing information — details of the images you license, the licence
              tier you select and your purchase history.
            </li>
            <li>
              Payment information — payments are handled by our payment provider, Stripe. We do
              not see or store your full card details; we receive only confirmation of payment
              and limited transaction data.
            </li>
            <li>
              Usage and technical information — when you visit the site we automatically collect
              technical data including your IP address, approximate location (country, region and
              city derived from your IP address), browser and device information, the pages you
              view and the site you arrived from.
            </li>
            <li>Communications — any messages you send to us.</li>
          </ul>

          <h2>3. How we use your information</h2>
          <p>
            We use your information to create and manage your account; process licence purchases
            and deliver image downloads; provide customer support; operate, maintain and improve
            the website; understand how the site is used; detect and prevent fraud, misuse and
            security incidents; and comply with our legal obligations.
          </p>

          <h2>4. Legal bases for processing</h2>
          <p>
            We process personal information on the following legal bases under the UK GDPR:
            performance of a contract, to provide the services and licences you request;
            legitimate interests, to operate, secure and improve our service and understand site
            usage, where this is not overridden by your rights; legal obligation, to comply with
            accounting, tax and other legal requirements; and consent, where we ask for it, which
            you may withdraw at any time.
          </p>

          <h2>5. Cookies and local storage</h2>
          <p>
            Our site uses your browser's local and session storage to remember your basket, your
            saved images and your recent search while you browse. We use a limited amount of
            analytics data to count visits. We do not use third-party advertising cookies. You
            can clear this data at any time through your browser settings.
          </p>

          <h2>6. Who we share your information with</h2>
          <p>
            We do not sell your personal information. We share information only with service
            providers who help us run the business, including Stripe (payment processing),
            Supabase (database and file hosting), Cloudflare (website hosting and content
            delivery) and an IP geolocation provider used to estimate the country of a visit.
            These providers process information on our behalf under appropriate agreements. We
            may also disclose information where required by law or to protect our rights.
          </p>

          <h2>7. International data transfers</h2>
          <p>
            Some of our service providers may process information outside the United Kingdom.
            Where this happens we take steps to ensure your information is protected by
            appropriate safeguards, such as the UK International Data Transfer Agreement or an
            equivalent mechanism.
          </p>

          <h2>8. Data retention</h2>
          <p>
            We keep account and transaction information for as long as your account is active and
            for as long afterwards as we are required to for legal, accounting and tax purposes.
            Technical and usage data is kept for a limited period for analytics and security.
            When information is no longer needed it is deleted or anonymised.
          </p>

          <h2>9. Your rights</h2>
          <p>
            Under the UK GDPR you have the right to access the personal information we hold about
            you; ask us to correct inaccurate information; ask us to delete your information;
            restrict or object to certain processing; request a copy of your information in a
            portable format; and withdraw consent where processing is based on consent. To
            exercise any of these rights, contact us at [insert contact email]. You also have the
            right to complain to the Information Commissioner's Office (ICO), the UK data
            protection regulator, at ico.org.uk.
          </p>

          <h2>10. Security</h2>
          <p>
            We take reasonable technical and organisational measures to protect your information,
            including encryption of passwords and secure, access-controlled hosting. No system is
            completely secure, but we work to protect your information and to respond promptly to
            any incident.
          </p>

          <h2>11. Children</h2>
          <p>
            Our service is intended for business and professional users and is not directed at
            children under 18. We do not knowingly collect personal information from children.
          </p>

          <h2>12. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. When we do, we will revise the date at
            the top of this page. Significant changes will be brought to your attention where
            appropriate.
          </p>

          <h2>13. Contact us</h2>
          <p>
            For any questions about this policy or your personal information, contact us at
            [insert contact email] or write to us at [insert company address].
          </p>
        </main>
        <nav className="legal-foot">
          <Link to="/">Home</Link>
          <Link to="/licence">Licence Agreement</Link>
        </nav>
      </div>
    </>
  );
}
