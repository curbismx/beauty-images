beauty08 goes on top of beauty07.

New prices and an Advertising licence
Small £49, Medium £99, Large £199 and a new fourth licence, Advertising, £799. For buyers outside the UK: $65, $129, $259 and $999. Every licence now runs for 12 months, worldwide, print and digital. The text under LICENCE DETAILS on each picture's page is rewritten for all four, and the Licensing page and the Licence terms say the same.

An Advertising licence takes the picture off sale for 12 months. When one is paid for, the picture stops being public and its page shows "Off sale until dd.mm.yyyy" instead of the price buttons, so nobody else can buy it. A daily job in the database puts it back on sale when the date passes. The admin's image page shows the same date under "Published to site".

Stripe
The site shows the amounts in src/lib/pricing.ts, but the amount charged is the Stripe price with the matching lookup key. Stripe prices cannot be changed once made, so eight new ones are needed, with the lookup keys moved across from the old prices. The paste prompt tells Lovable to do this through its Stripe connector. Until it has, the site shows the new prices and charges the old ones, so do not publish until the prices are made.

Files
src/lib/pricing.ts (new amounts, Advertising tier, lookup keys license_advertising_gbp and license_advertising_usd)
src/lib/stripe.server.ts (the Advertising product gets the digital goods tax code too)
src/lib/payments.functions.ts (checkout refuses a picture that is off sale)
src/lib/search.functions.ts (a held picture's page still opens, with the date)
src/lib/images.functions.ts (admin image detail carries held_until)
src/lib/order.functions.ts
src/lib/email-templates/order-confirmation.tsx
src/routes/image.$id.tsx (new text for each price, A button, off sale notice)
src/routes/basket.tsx
src/routes/checkout.return.tsx
src/routes/licensing.tsx
src/routes/licence.tsx
src/routes/admin.tsx (one small style)
src/routes/admin.image.$id.tsx ("Off sale until" line)
src/routes/api/public/payments/webhook.ts (recognises the Advertising licence and takes the picture off sale)
src/routes/api/public/download.ts
src/integrations/supabase/types.ts (held_until)
supabase/migrations/20261116170000_bi_advertising_hold.sql (held_until column, release_held_images function, daily pg_cron job at 03:15 UTC)

Copy every file into the same place in the project, replacing what is there, run the migration, make the Stripe prices as the prompt says, then publish.
No secrets.
