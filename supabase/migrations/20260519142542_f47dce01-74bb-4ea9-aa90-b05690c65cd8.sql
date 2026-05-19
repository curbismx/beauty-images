
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  visit_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  country text,
  city text,
  region text,
  user_agent text,
  referer text,
  path text,
  visit_count int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ip, visit_date)
);

CREATE INDEX idx_visitors_date ON public.visitors (visit_date DESC);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Admins (authenticated) can read; nobody writes via PostgREST (writes go through server fn with service role)
CREATE POLICY "auth read visitors" ON public.visitors FOR SELECT TO authenticated USING (true);
