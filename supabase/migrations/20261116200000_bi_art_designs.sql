-- Email designs for the art directors' outreach, uploaded from the Curbism
-- admin and kept here so a design can be chosen again later. Server only.
create table if not exists public.art_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists art_designs_name on public.art_designs (lower(name));

alter table public.art_designs enable row level security;
revoke all on table public.art_designs from anon, authenticated;
grant all on table public.art_designs to service_role;

-- Opens and clicks for each email sent. Every email carries a key of its
-- own in its picture and links; the key is what the tracking routes get.
alter table public.art_sends add column if not exists key uuid not null default gen_random_uuid();
alter table public.art_sends add column if not exists opened_at timestamptz;
alter table public.art_sends add column if not exists opens integer not null default 0;
alter table public.art_sends add column if not exists clicked_at timestamptz;
alter table public.art_sends add column if not exists clicks integer not null default 0;
alter table public.art_sends add column if not exists last_url text not null default '';
create unique index if not exists art_sends_key on public.art_sends (key);
