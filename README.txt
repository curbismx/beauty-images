beauty07 goes on top of beauty06.

Visits: people only
Robots, crawlers, link previewers, monitors and scripts were being counted as visitors. From now on the tracker turns them away, and the ones already recorded are marked (a new is_bot column on visitors) so every figure in the Curbism admin leaves them out: the four tiles, the chart, sources, countries, pages and the recent visitors. The Curbism admin also shows what each recent visitor read with ("Safari on iPhone", "Chrome on Windows"), from the browser description already kept.

The site's own dashboard at beautyimages.com/admin is not touched; it still counts everything.

Files
src/lib/browser.ts (new)
src/routes/api/public/track.ts
src/lib/curbism.server.ts
supabase/migrations/20261116120000_bi_people_only.sql (adds is_bot to visitors, marks the robot rows already there, and replaces the curbism_visits function so it counts people only)

Copy every file into the same place in the project, replacing what is there, run the migration, then publish.
No secrets.
