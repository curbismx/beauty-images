beauty13 goes on top of beauty12 (or beauty10 if beauty11 and beauty12 were never installed; it does not matter).

Email designs
A new table, art_designs, keeps the email designs uploaded from the Curbism admin (name, HTML, date). Up to 30; uploading a file with the same name replaces that design.

Opens and clicks
Every email now carries a tiny invisible picture that reports when the email is opened, and every web link in it goes through beautyimages.com first so the click is logged before the reader is sent on. Mail links and the unsubscribe link are left alone. art_sends gains key, opened_at, opens, clicked_at, clicks and last_url. Two new addresses do the logging: /api/public/o (the picture) and /api/public/c (the links). Both are signed, so nobody can fake an open or a click. The admin's new Emails page reads it all back through the Curbism link.

The email picture
public/email/banner.jpg is the collage with the pink Beauty Images bar across the top, 1200 x 548. It replaces the one from beauty12.

Files
src/lib/outreach.server.ts (designs, tracking, the sends list)
src/lib/curbism.server.ts (new actions art_designs, art_design_save, art_design_delete, art_sends)
src/routes/api/public/o.ts (new)
src/routes/api/public/c.ts (new)
src/routeTree.gen.ts (regenerated for the two new routes; Lovable regenerates it anyway)
supabase/migrations/20261116200000_bi_art_designs.sql
public/email/banner.jpg

Copy every file into the same place in the project, replacing what is there, run the migration, then publish.
No secrets.
