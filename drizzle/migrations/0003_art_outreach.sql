alter table public.art_contacts
  add column if not exists queued_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists bounce_note text;

create index if not exists art_contacts_queued on public.art_contacts (queued_at) where queued_at is not null;

create table if not exists public.art_outreach (
  id integer primary key default 1 check (id = 1),
  sending boolean not null default false,
  daily_limit integer not null default 20 check (daily_limit between 1 and 200),
  subject text not null default '',
  html text not null default '',
  from_name text not null default 'Beauty Images',
  from_email text not null default 'mail@beautyimages.net',
  reply_to text not null default '',
  footer text not null default '',
  test_to text not null default '',
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  mail_uid integer not null default 0,
  running_at timestamptz,
  last_run_at timestamptz,
  last_note text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.art_outreach (id) values (1) on conflict (id) do nothing;

alter table public.art_outreach enable row level security;
revoke all on table public.art_outreach from anon, authenticated;
grant all on table public.art_outreach to service_role;

create table if not exists public.art_sends (
  id bigint generated always as identity primary key,
  contact_id uuid not null references public.art_contacts (id) on delete cascade,
  sent_at timestamptz not null default now(),
  to_email text not null,
  subject text not null default '',
  status text not null check (status in ('sent', 'failed', 'bounced', 'test')),
  note text not null default ''
);

create index if not exists art_sends_sent_at on public.art_sends (sent_at desc);
create index if not exists art_sends_contact on public.art_sends (contact_id);

alter table public.art_sends enable row level security;
revoke all on table public.art_sends from anon, authenticated;
grant all on table public.art_sends to service_role;