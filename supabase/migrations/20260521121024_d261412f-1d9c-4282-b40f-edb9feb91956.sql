SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-pending-images';

SELECT cron.schedule(
  'process-pending-images',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--1beb613f-ac58-40e2-a5c8-715879d8eb92.lovable.app/api/public/hooks/process-pending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value #>> '{}' FROM public.settings WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);