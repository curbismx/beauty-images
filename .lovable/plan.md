## Goal
Mirror the upload page's "Upload errors" panel on `/admin/library`, so admins can triage files that never made it into the library without leaving the page.

## Changes

**`src/routes/admin.library.tsx`**
- Reuse the existing server functions already used by upload: `listUploadErrors`, `deleteUploadErrors`, `resolveUploadError` (from `@/lib/images.functions`).
- Add a query: `["upload-errors"]` → `listUploadErrors({ data: { limit: 300 } })`.
- Add mutations for delete and resolve, invalidating `["upload-errors"]` and `["image-stats"]`.
- Render a new "Upload errors" section above (or below) the image list, matching the upload page's look:
  - Section heading with count
  - Loading / empty states
  - One card per error showing filename, detected image number, error message, and **Fix** + **Delete** buttons
- Extract the existing `UploadErrorCard` from `admin.upload.tsx` into a shared component (`src/components/UploadErrorCard.tsx`) and import it on both pages so the UI stays consistent and we don't duplicate code.

## Out of scope
- No changes to the per-row Retry button or "Retry all failed" — they already exist and work.
- No new server functions; everything needed is already exported from `images.functions.ts`.
