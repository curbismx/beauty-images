## 1. New `/contact` page (`src/routes/contact.tsx`)

- Plain white page, matching style of other routes.
- Centered BEAUTYIMAGES logo positioned the same as on the homepage hero (top-center, using the existing `hero-logo` styling pattern).
- Intro copy: "Any queries or support issues please contact us direct through the management company **mail@curbism.com** or fill in the form below."
- Simple form: Name, Email, Message (zod-validated, max lengths, trim).
- Submit calls a new server function `submitContactForm` in `src/lib/contact.functions.ts` that uses the existing `sendTransactionalEmail` helper to deliver to `mail@curbism.com`.
- Success/error inline feedback; no auth required.
- Own `head()` meta (title, description, og:title/description).

## 2. New email template (`src/lib/email-templates/contact-form.tsx`)

- React Email template rendering sender name/email/message.
- Registered in `src/lib/email-templates/registry.ts` with fixed `to: "mail@curbism.com"`.
- Subject: `New contact form submission — BEAUTYIMAGES`.

## 3. Header changes on homepage (`src/routes/index.tsx`)

**Desktop (current AccountLink area, top-right):**
- Add a "Contact" link next to the existing Log in / account icon, using the same `hero-account` styling.

**Mobile (≤ ~640px):**
- Hide the inline desktop links.
- Show a single `+` button (top-right, same position) that toggles a full-screen overlay menu containing:
  - Contact
  - Log in / Log out (uses session)
  - Lightbox (with count badge, links to `/lightbox`)
  - Basket (links to `/basket`)
- `+` rotates to `×` when open. Tap outside or any link closes it.
- Pure CSS additions in the existing `<style>` block (no new deps).

## 4. Files touched

- `src/routes/contact.tsx` (new)
- `src/lib/contact.functions.ts` (new)
- `src/lib/email-templates/contact-form.tsx` (new)
- `src/lib/email-templates/registry.ts` (edit — register template)
- `src/routes/index.tsx` (edit — header markup + mobile menu + styles)

## Technical notes

- Email is delivered via the existing Lovable email queue (`sendTransactionalEmail` → `enqueue_email`), so it inherits retry/suppression/logging. Email domain `notify.beautyimages.com` is already set up.
- Form server fn does its own zod validation and uses an idempotency key (e.g. `contact-${timestamp}-${hash(email+message)}`) to dedupe accidental double-submits.
- No DB schema changes.
