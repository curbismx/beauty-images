-- Image jobs now run only while there are images waiting.
-- The every-minute schedule is created as soon as an image needs a preview
-- or keywords, and removed again once nothing is left. When no pictures are
-- waiting, nothing runs and the database stays idle.

-- 1. Remove the always-on schedules (the preview job and the old keyword job).
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command LIKE '%/api/public/hooks/process-pending%'
   OR command LIKE '%/api/public/hooks/keyword-pending%';

-- 2. Is any image still waiting for a preview or keywords?
--    Matches what the process-pending job picks up.
CREATE OR REPLACE FUNCTION public.image_jobs_waiting()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.images
    WHERE processing_attempts < 3
      AND (preview_path IS NULL OR keyworded_at IS NULL)
  );
$fn$;

-- 3. Start the every-minute schedule (does nothing if it is already running).
CREATE OR REPLACE FUNCTION public.start_image_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-images') THEN
    RETURN;
  END IF;
  PERFORM cron.schedule(
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
END;
$fn$;

-- 4. Wake the job when images are added or reset and need work.
--    A shared lock lets uploads run side by side while stopping the job
--    from going to sleep before a new upload has been saved.
CREATE OR REPLACE FUNCTION public.wake_image_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM new_rows
    WHERE processing_attempts < 3
      AND (preview_path IS NULL OR keyworded_at IS NULL)
  ) THEN
    RETURN NULL;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock_shared(4127310);
  PERFORM public.start_image_jobs();
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS images_wake_jobs_insert ON public.images;
CREATE TRIGGER images_wake_jobs_insert
  AFTER INSERT ON public.images
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.wake_image_jobs();

DROP TRIGGER IF EXISTS images_wake_jobs_update ON public.images;
CREATE TRIGGER images_wake_jobs_update
  AFTER UPDATE ON public.images
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.wake_image_jobs();

-- 5. Put the job to sleep once nothing is waiting. Called by the job itself
--    at the end of each run. Returns true if the schedule was stopped.
CREATE OR REPLACE FUNCTION public.sleep_image_jobs()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(4127310);
  IF public.image_jobs_waiting() THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-images') THEN
    PERFORM cron.unschedule('process-pending-images');
  END IF;
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.image_jobs_waiting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_image_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wake_image_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sleep_image_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.image_jobs_waiting() TO service_role;
GRANT EXECUTE ON FUNCTION public.sleep_image_jobs() TO service_role;

-- 6. If anything is already waiting, start the job now.
DO $do$
BEGIN
  IF public.image_jobs_waiting() THEN
    PERFORM public.start_image_jobs();
  END IF;
END;
$do$;
