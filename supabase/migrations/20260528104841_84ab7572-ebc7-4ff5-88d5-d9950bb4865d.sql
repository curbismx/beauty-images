CREATE TABLE IF NOT EXISTS public.page_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text NOT NULL,
  session_id text,
  path       text,
  referer    text,
  country    text,
  city       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;

CREATE INDEX IF NOT EXISTS page_views_ip_created_idx ON public.page_views (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_created_idx     ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_session_idx     ON public.page_views (session_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read page_views" ON public.page_views;
CREATE POLICY "Admins read page_views"
  ON public.page_views FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));