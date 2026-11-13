-- Emails to the art directors, sent a few an hour from the Curbism admin's
-- queue as mail@beautyimages.net, with bounces read back from the mailbox.
-- Only the server can read or write any of this; the Curbism admin reaches
-- it over its private link.

-- ------------------------------------------------------------ people

-- Where each person is with the email: waiting in the queue, sent (the
-- existing last_emailed_at), come back (bounced), or asked for no more
-- (the existing unsubscribed_at).
alter table public.art_contacts
  add column if not exists queued_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists bounce_note text;

create index if not exists art_contacts_queued on public.art_contacts (queued_at) where queued_at is not null;

-- ------------------------------------------------------------ the email

-- The one email and how it goes out. One row.
create table if not exists public.art_outreach (
  id integer primary key default 1 check (id = 1),
  -- Switched on, the hourly run sends; switched off, the queue just waits.
  sending boolean not null default false,
  daily_limit integer not null default 20 check (daily_limit between 1 and 200),
  subject text not null default '',
  html text not null default '',
  from_name text not null default 'Beauty Images',
  from_email text not null default 'mail@beautyimages.net',
  reply_to text not null default '',
  -- Under every email: the business's name and address, then the unsubscribe link.
  footer text not null default '',
  -- Where test emails go.
  test_to text not null default '',
  -- Signs each unsubscribe link, and nothing else.
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- How far through the mailbox the bounce check has read.
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

-- ------------------------------------------------------------ what went out

-- One row for every email sent, or that failed, or that came back.
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
