-- The hourly art director run was being cut off. The database's web call
-- gives up after 5 seconds by default, and a run (sign in to the mail
-- server, send a few, then read the mailbox for bounces) takes longer, so
-- the site stopped the run before anything went out. This gives each call
-- two minutes. Same times as before: on the hour, 9 to 4 UTC, weekdays.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'art-outreach') then
    perform cron.unschedule('art-outreach');
  end if;
end $$;

select cron.schedule(
  'art-outreach',
  '0 9-16 * * 1-5',
  $$ select net.http_post(
       url := 'https://beautyimages.com/api/public/outreach',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb,
       timeout_milliseconds := 120000
     ) $$
);

-- Clear a run left marked as "running" by a call that was cut off.
update public.art_outreach set running_at = null where id = 1;
