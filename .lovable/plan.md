I found no sign this is caused by your internet. The likely cause is a build/publish issue introduced in the recent image route changes, not connectivity.

What I checked:
- `src/routes/api/public/preview-image.$id.ts` now builds a public server route that reads backend environment values and serves stored image bytes.
- `src/routes/image.$id.tsx` references the new watermark assets, and those files exist in `public/`.
- Recent preview logs show the local dev server/esbuild process crashing with `write EPIPE` / `callback is not a function`, which points to a build/dev toolchain failure rather than network failure.

Plan to fix after approval:
1. Get the exact failing signal from the app logs/build output instead of guessing.
2. Check whether the recently added image-processing packages or server-route code are triggering the publish crash.
3. Make the smallest safe fix only, preserving your current image/watermark behavior.
4. Verify the relevant build/publish-blocking error is gone before saying it is fixed.