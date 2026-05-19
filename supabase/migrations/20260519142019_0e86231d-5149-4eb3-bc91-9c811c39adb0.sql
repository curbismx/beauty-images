
-- Tables
CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text NOT NULL,
  caption text,
  keywords text[] NOT NULL DEFAULT '{}',
  model_release boolean NOT NULL DEFAULT false,
  model_release_pdf_path text,
  category text,
  pricing_tier text,
  availability text NOT NULL DEFAULT 'available',
  admin_notes text,
  featured boolean NOT NULL DEFAULT false,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  company text,
  industry text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES public.images(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount numeric,
  currency text NOT NULL DEFAULT 'GBP',
  usage_type text,
  territory text,
  duration_months int,
  exclusivity text,
  license_starts date,
  license_ends date,
  stripe_payment_id text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb
);

INSERT INTO public.settings (key, value) VALUES
  ('stripe_keys', '{}'::jsonb),
  ('gemini_api_key', '{}'::jsonb),
  ('pricing_tiers', '{}'::jsonb);

-- RLS: admin-only (any authenticated user is treated as admin in this single-admin app)
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth all images" ON public.images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('images-private', 'images-private', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read images-private" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'images-private');
CREATE POLICY "auth write images-private" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'images-private');
CREATE POLICY "auth update images-private" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'images-private');
CREATE POLICY "auth delete images-private" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'images-private');
