-- The Email traffic light is now a value on each person, set to Emailed by
-- the sending. Everyone already emailed gets it switched on.
update public.art_contacts
set details = coalesce(details, '{}'::jsonb) || '{"email_status": "emailed"}'::jsonb
where last_emailed_at is not null
  and coalesce(details->>'email_status', '') = '';
