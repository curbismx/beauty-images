-- An Advertising licence takes the picture off sale for twelve months. The
-- webhook marks the picture (public off, held_until set) when the licence
-- is paid; this daily job puts it back on sale when the date passes.
alter table public.images add column if not exists held_until timestamptz;

create index if not exists images_held_until on public.images (held_until) where held_until is not null;

create or replace function public.release_held_images()
returns integer
language sql
security definer
set search_path = ''
as $$
  with released as (
    update public.images
    set public = true, held_until = null
    where held_until is not null and held_until <= now()
    returning id
  )
  select count(*)::integer from released;
$$;

revoke all on function public.release_held_images() from public, anon, authenticated;
grant execute on function public.release_held_images() to service_role;

-- Once a day, early morning UTC.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'release-held-images') then
    perform cron.unschedule('release-held-images');
  end if;
end $$;

select cron.schedule(
  'release-held-images',
  '15 3 * * *',
  $$ select public.release_held_images() $$
);
