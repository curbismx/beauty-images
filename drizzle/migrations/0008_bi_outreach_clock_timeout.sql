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

update public.art_outreach set running_at = null where id = 1;