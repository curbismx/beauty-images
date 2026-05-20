
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS download_tier text,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_stripe_session_id ON public.sales(stripe_session_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('images-derived', 'images-derived', false)
ON CONFLICT (id) DO NOTHING;
