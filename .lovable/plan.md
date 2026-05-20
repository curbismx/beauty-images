
## Goal

After checkout, the buyer lands on a page that lists every image they bought with a download button per image, delivering the file at the tier they paid for (S 800 px / M 2000 px / L 5400 px on the longest edge). They also receive an email with a link back to that same page so they can return and re-download later.

---

## 1. Database

Add to the `sales` table:
- `stripe_session_id text` (the Stripe Checkout Session ID — used as the buyer's access token for the downloads page)
- `download_tier text` (`small` | `medium` | `large` — explicit, not derived from price)
- `download_count int default 0`
- `last_downloaded_at timestamptz`

The Stripe Session ID is unguessable (28+ random chars), so possession of it = entitlement. No login required to download (buyer might have checked out as guest). This matches Stripe's own pattern for `return_url`.

Update the webhook (`/api/public/payments/webhook`) to write `stripe_session_id` and `download_tier` per row when inserting sales.

## 2. Image resizing on Cloudflare Workers

`sharp` does not work in the Worker runtime. Use `@jsquash/jpeg` + `@jsquash/resize` (pure WASM, Worker-compatible). Pipeline per download:
1. Fetch original from `images-private` storage bucket via `supabaseAdmin`.
2. Decode → resize so the longest edge ≤ tier max (800 / 2000 / 5400) → re-encode JPEG q≈90.
3. Stream back as `image/jpeg` with `Content-Disposition: attachment; filename="BEAUTYIMAGES_00123_M.jpg"`.

Cache resized output in storage (`images-derived/{image_id}/{tier}.jpg`) so repeat downloads skip the resize work.

## 3. Download server route

Public route `src/routes/api/public/download.ts` — `GET /api/public/download?session_id=...&image_id=...`:
- Look up the `sales` row by `(stripe_session_id, image_id)`. 404 if not found.
- Resolve/produce the resized file (cache hit or fresh resize).
- Increment `download_count`, set `last_downloaded_at`.
- Return the JPEG.

No auth header needed — the session_id IS the entitlement token.

## 4. Downloads page

Rewrite `src/routes/checkout.return.tsx`:
- Reads `session_id` from URL.
- Calls a new `getOrderBySession` server function (validated, accepts only the session_id) which returns `[{ image_id, tier, image_number, title, signed_preview_url }]`.
- Renders a grid of thumbnails with `[ DOWNLOAD · S/M/L ]` buttons that hit `/api/public/download?session_id=…&image_id=…`.
- Clears the basket on first load (already does this).
- Shows the URL in a "bookmark this link" callout so buyers know they can return.

## 5. Receipt email

Set up Lovable's built-in email system, then send a receipt the moment the webhook fires:
- Branded template `order-receipt.tsx` listing each image (number, tier, price), total, and a prominent **"Download your images"** button pointing to `https://beautyimages.lovable.app/checkout/return?session_id=…`.
- Triggered from the webhook with `idempotencyKey = ` order-receipt-${sessionId}` so Stripe retries don't double-send.

Prereq: email domain setup. If no domain is configured yet, the response will show the setup dialog first, then continue with the rest.

---

## Technical notes

- Resize cache bucket needs to exist (`images-derived`, private) — added in the same migration.
- Webhook today inserts one `sales` row per image. We'll set `download_tier` from the basket metadata already passed through (`imageIds` + per-line price IDs map 1:1 to tier).
- The download endpoint must validate `image_id` belongs to that session — never trust the client.
- File naming: `BEAUTYIMAGES_{image_number padded}_{S|M|L}.jpg`.
- WASM packages add ~1MB to the Worker bundle — well within Cloudflare's 10MB limit.

---

## Open question before I build

For the email setup — do you already have a domain you want emails to come from (e.g. `notify@beautyimages.co.uk`)? If yes, what's the root domain? If you'd rather skip email for now and just ship the downloads page, that's fine too — say the word.
