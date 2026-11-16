beauty14 goes on top of beauty13.

The Email traffic light
The Email field on each art director is now a traffic light like Nuron's, kept on the person. Its lights are set in the folder settings (colour, name, order); it starts with one, Emailed, in red, and Hywel adds his own after it (Lead, Client and so on). The sending switches a person's light to Emailed when it emails them and their light is off. Everyone already emailed gets Emailed switched on by the migration.

Email one person now
A new action, art_send_one, sends the saved email to one person straight away from their page in the admin, outside the queue and the daily count. It refuses someone with no address, who unsubscribed, or whose address bounced. Logged like any other send, so it shows on the Emails page with opens and clicks.

Files
src/lib/artDirectors.server.ts (lights on a field, the light value on a person)
src/lib/outreach.server.ts (markEmailed, sendOne)
src/lib/curbism.server.ts (art_send_one)
supabase/migrations/20261116210000_bi_emailed_light.sql

Copy every file into the same place in the project, replacing what is there, run the migration, then publish.
No secrets.
