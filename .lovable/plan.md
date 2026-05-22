## Goal

On the image detail page (`/image/$id`), always serve and display the small 800px preview — never the full original. Constrain the displayed image inside a fixed 800×600 box sitting within the existing 75px black frame, with a 75px gap between the image and the licence/text section.

## Part 1 — Make `preview_path` an actual 800px image

Today, `processPreviews()` in `src/routes/api/public/hooks/process-pending.ts` uploads the original bytes unchanged to `previews/{id}.jpg`. That's why the "preview" is actually the full-resolution file.

Change it to resize to **max edge 800px, JPEG q82**, using `@cf-wasm/photon` (already used in `src/routes/api/public/download.ts` — same Worker-compatible pattern, no new dependency).

- Extract the resize helper into `src/lib/resize-jpeg.server.ts` so both `download.ts` and `process-pending.ts` can share it (returns `Uint8Array`, takes input + maxEdge).
- In `processPreviews()`: after downloading the original, call `resizeJpeg(inBytes, 800)` and upload the resized bytes. If resize throws, log and fall back to original (current behaviour) so a bad image doesn't block the queue.

## Part 2 — Regenerate existing previews

All previews already in storage are full-size copies. Add a one-shot admin action to rebuild them:

- New server fn `regenerateAllPreviews()` in `src/lib/images.functions.ts` (admin-only via `requireAdmin` middleware) that clears `preview_path` for all rows in batches of N, then the existing `process-pending` cron/endpoint will recreate them at 800px.
- Add a small **"Regenerate previews"** button on `/admin/settings` (or `/admin/library` header) that calls it and shows the count queued.

## Part 3 — Image page layout (`src/routes/image.$id.tsx`)

Update the CSS only — no logic changes. Replace the current `.img-stage` / `.img-frame` / `.img-el` rules with a fixed display box:

- `.img-stage` keeps `padding: 75px 75px 0` (top + sides; bottom handled below).
- New `.img-box`: `width: min(800px, 100% );  height: 600px; display: flex; align-items: center; justify-content: center;` — this is the constraining box. It centers (or left-aligns, your call — current page is left-aligned) within the available width but never exceeds 800×600.
- `.img-el`: `max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;` so:
  - portrait images fill 600px height,
  - landscape images fill 800px width,
  - smaller images render at their natural size,
  - the image never grows past 800×600 even on huge viewports.
- Below the box: a fixed **75px gap**, then the licence buttons / `LICENCE DETAILS` block (`.lc-detail--under`). Replace the current `margin-top: 75px` on `.lc-btn-row` with a `margin-top: 75px` on `.lc-detail--under` (or a spacer div) so the gap is between the image box and the whole text block, not just the buttons.
- Remove the old `max-height: calc(100vh - 150px)` rule on `.img-el` since the 800×600 box now bounds it.

Wrap the `<img>` in `<div className="img-box">` inside `.img-frame`.

### Mobile

On viewports narrower than ~800+150px the box already shrinks via `width: min(800px, 100%)`. Keep `height: 600px` as-is per the brief ("if the page width is more than this do not let the preview image go any bigger") — narrow screens just get a shorter effective image because `object-fit: contain` preserves aspect ratio inside the box.

## Out of scope

- No changes to `download.ts` (paid downloads still use the original + resize on demand).
- No changes to the similar-images grid or any other page.
- No new image variants beyond the existing `preview_path`.
