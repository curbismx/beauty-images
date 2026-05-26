## Goal

Make Beauty Images discoverable by professional art buyers via qualified mid- and long-tail search, and route them straight from Google Images into a licence. No mass-market head-term chasing. Everything keyed off the positioning in your brief.

## Two things to confirm before I implement

1. **Collection set.** Categories in the DB today are mostly `Portrait` (3,667), `Lifestyle`, `Fashion`, `Business`, etc. — these came from the AI auto-keyworder and don't match the beauty brief. I'd like to build curated **collection** routes instead, each backed by a fixed keyword search. Proposed MVP set: **skin, make-up, hair, fragrance, men's grooming, fashion beauty, editorial portraits, diversity & real-skin**. OK to start with these, or do you want a different list?
2. **Existing `/licence` page.** It's the legal terms doc. I'll add a separate `/licensing` page as the transactional explainer (RM model, Small/Medium/Large tiers, why you'd licence here). The legal `/licence` page stays as-is. OK?

## What gets built

### 1. Sitewide root metadata (`src/routes/__root.tsx`)

Replace the leftover Lovable defaults:

- Title default → `Beauty Images — Rights-Managed Beauty Photography`
- Description → positioning sentence (real photography, no AI, exclusive, for advertising & editorial)
- Remove the root-level `og:image` (it currently overrides every leaf — see the head-meta rules) and the `twitter:site: @Lovable`
- Set `og:site_name`, `og:type: website`, `twitter:card: summary_large_image`
- Add **Organization JSON-LD** (name, URL, logo, founding year ~2003 implied by "over 20 years", description)
- Add a `<meta name="theme-color">` and proper favicon set

### 2. Per-route bespoke `head()` on every public leaf

Each route gets its own title, description, og:title/description, og:url, canonical, and (where it has a hero/image) og:image. No two pages share the same metadata.

Routes touched: `/` (home), `/contact`, `/licence`, `/privacy`, `/image/$id`, plus the new routes below.

### 3. The single biggest SEO win — image pages (`src/routes/image.$id.tsx`)

This is brief §8, and it's where the buyer actually lands from Google Images.

- Dynamic `<title>` and `<meta description>` derived from the image's `title` / `caption` / keywords + brand suffix
- Canonical = `https://beautyimages.com/image/{id}`
- `og:image` / `twitter:image` = the watermarked preview URL (absolute)
- `og:type: article`
- **`ImageObject` JSON-LD** with `creator`, `copyrightHolder`, `license` (→ `/licence`), `acquireLicensePage` (→ `/image/{id}`), `creditText`, `contentUrl` — this is what makes Google show the **"Licensable" badge** in Google Images
- **`Product` + `Offer` JSON-LD** with three `Offer` entries for Small/Medium/Large at the regional GBP/USD/EUR prices
- **`BreadcrumbList`** (Home → Collection → Image)
- Add `<h1>` with the image title (page currently uses a styled div) and tighten the `<img alt>` to use title + caption + "Rights-managed beauty photography" rather than just title

### 4. New SEO foundation pages

Each is its own route with bespoke `head()`, JSON-LD, and editorial copy written in professional buyer vocabulary (rights-managed, exclusive, editorial use, commercial use, real photography).

- **`/about`** — 20+ years, exclusivity, editorial credibility. `WebPage` + `Organization` schema.
- **`/licensing`** — transactional explainer: how rights-managed works, what Small/Medium/Large each suit, worldwide 12-month digital rights, how to licence directly online. `FAQPage` schema for common buyer questions.
- **`/real-photography-no-ai`** — brief §5. Standalone landing page making the no-AI guarantee explicit and quotable. Title and description tuned for `AI-free stock photography`, `real photography not AI`, `authentic human photography`. `WebPage` schema.
- **`/collections`** — index of all curated collections. `CollectionPage` schema.
- **`/collections/$slug`** — one route file, eight slugs (see confirmation #1 above). Each renders a hand-written intro paragraph + a results grid from `searchPublicImages(keyword)` + `BreadcrumbList` + `CollectionPage` schema. Indexable, unique-content pages — the "category workhorses" from brief §6.

### 5. Sitemap & robots

- **`src/routes/sitemap[.]xml.ts`** — replace `request.origin` with hard-coded `https://beautyimages.com` (so the canonical domain is always served, regardless of which hostname the crawler hit), add static routes (`/about`, `/licensing`, `/real-photography-no-ai`, `/contact`, `/licence`, `/privacy`, `/collections`, each `/collections/$slug`), keep the per-image entries
- **New `src/routes/image-sitemap[.]xml.ts`** — Google **Image Sitemap** protocol (`xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`). One `<url>` per image page with nested `<image:image>` carrying `image:loc`, `image:title`, `image:caption`, `image:license`. This directly accelerates image indexing.
- **`public/robots.txt`** — add `Sitemap: https://beautyimages.com/image-sitemap.xml` alongside the existing one. Existing disallows are already correct.

### 6. Noindex on private/utility routes

Per-route `head()` adds `<meta name="robots" content="noindex,nofollow">` on `/basket`, `/lightbox`, `/account`, `/login`, `/signup`, `/reset-password`, `/checkout/return`, `/unsubscribe`, and all `/admin/*` routes. (robots.txt already disallows crawling — this is belt-and-braces in case anything gets linked.)

### 7. Faceted-search hygiene (brief §9)

Search is currently entirely client-side (no URL params), so it does not spawn indexable URLs — already safe by accident. I'll add a comment to keep it that way and ensure `<meta robots="noindex">` is emitted if/when search ever lands at a URL.

### 8. Small content fixes

- Replace remaining "CURBISM Workspace" / "Lovable" copy that crept into root metadata
- Tighten result-card `<img alt>` on the home grid to use `title` (falling back to caption, then "Beauty photography from Beauty Images") instead of empty/generic strings
- Ensure every result link uses descriptive anchor text where possible

## Out of scope for this pass (flagging for later)

- **IPTC metadata embedded in the JPEG bytes** — Google's "Licensable" badge can use either JSON-LD or IPTC; JSON-LD is enough to earn the badge. Embedding IPTC into the watermarking pipeline is a separate, larger backend job.
- **Blog / journal** for editorial freshness and link-building (brief §6) — separate piece of work; mention only.
- **hreflang / localised pages** — brief §11 says not needed yet; I'll do nothing here.
- **Competitor list & subject-specific long-tail keywords** (brief end note) — you flagged these as things to feed back later; the collection slugs above are the placeholder.

## Technical details

- All `head()` blocks follow the TanStack pattern: `title` lives inside the `meta` array (not a top-level field), `canonical` lives in `links` and only on **leaf** routes (TanStack concatenates `links` without dedup), JSON-LD lives in `scripts`. Per-route `og:image` set on leaves only — never on root or layout routes.
- Image-page absolute URLs built from `request.url` origin on the server (so they work for both `beautyimages.com` and the preview/published domains).
- Collection pages reuse the existing `searchPublicImages` server fn with a fixed query string; no new search backend work.
- Sitemap pagination already exists; image sitemap reuses the same paging.
- No DB schema changes. No new dependencies.

## Files touched

```text
edited:
  src/routes/__root.tsx              ← brand metadata, Organization JSON-LD
  src/routes/index.tsx                ← head() + WebSite/SearchAction JSON-LD, alt-text fix
  src/routes/image.$id.tsx            ← ImageObject + Product/Offer + Breadcrumb JSON-LD, h1, alt
  src/routes/contact.tsx              ← bespoke head()
  src/routes/licence.tsx              ← canonical + og:url
  src/routes/privacy.tsx              ← bespoke head(), canonical
  src/routes/sitemap[.]xml.ts         ← canonical domain + static routes
  src/routes/{basket,lightbox,account,login,signup,reset-password,
              checkout.return,unsubscribe}.tsx  ← noindex head()
  src/routes/admin*.tsx               ← noindex head() (layout-level)
  public/robots.txt                   ← add image sitemap line

created:
  src/routes/about.tsx
  src/routes/licensing.tsx
  src/routes/real-photography-no-ai.tsx
  src/routes/collections.tsx
  src/routes/collections.$slug.tsx
  src/routes/image-sitemap[.]xml.ts
```

Once you confirm the two items at the top, I'll build everything in one pass.
