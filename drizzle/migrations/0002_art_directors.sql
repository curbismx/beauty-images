-- Art directors: the people found through Apollo for Beauty Images, worked
-- from the Curbism admin (curbism.com/admin). Only the server can read or
-- write any of this; the Curbism admin reaches it over its private link.

-- ------------------------------------------------------------ people

create table if not exists public.art_contacts (
  id uuid primary key default gen_random_uuid(),
  -- What Apollo knows them by, so no one is brought in twice.
  apollo_id text unique,
  name text not null default '',
  -- Every detail by field (job title, company, email and any added in the
  -- folder settings), as the folder settings name them.
  details jsonb not null default '{}'::jsonb,
  notes text not null default '',
  -- Their photo, in the private art-contact-photos bucket.
  photo_path text,
  -- Ready for sending: when they last had an email, and whether they said no more.
  last_emailed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists art_contacts_created on public.art_contacts (created_at desc);
create index if not exists art_contacts_email on public.art_contacts (lower(details->>'email'));

alter table public.art_contacts enable row level security;
revoke all on table public.art_contacts from anon, authenticated;
grant all on table public.art_contacts to service_role;

-- ------------------------------------------------------------ settings

-- The folder settings: which details there are, in what order, which show
-- on a person's page and which show in the list. One row.
create table if not exists public.art_settings (
  id integer primary key default 1 check (id = 1),
  fields jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.art_settings enable row level security;
revoke all on table public.art_settings from anon, authenticated;
grant all on table public.art_settings to service_role;

-- ------------------------------------------------------------ photos

