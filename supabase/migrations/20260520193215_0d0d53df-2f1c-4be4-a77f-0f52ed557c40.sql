
-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- has_role helper
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'mail@curbism.com'
ON CONFLICT DO NOTHING;

-- images
DROP POLICY IF EXISTS "auth all images" ON public.images;
CREATE POLICY "admin all images" ON public.images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- customers
DROP POLICY IF EXISTS "auth all customers" ON public.customers;
CREATE POLICY "admin all customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sales (keep "Users view own sales")
DROP POLICY IF EXISTS "auth all sales" ON public.sales;
CREATE POLICY "admin all sales" ON public.sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- settings
DROP POLICY IF EXISTS "auth all settings" ON public.settings;
CREATE POLICY "admin all settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- featured_images (keep public read)
DROP POLICY IF EXISTS "auth write featured_images" ON public.featured_images;
CREATE POLICY "admin write featured_images" ON public.featured_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- visitors
DROP POLICY IF EXISTS "auth read visitors" ON public.visitors;
CREATE POLICY "admin read visitors" ON public.visitors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage: images-private
DROP POLICY IF EXISTS "auth read images-private" ON storage.objects;
DROP POLICY IF EXISTS "auth write images-private" ON storage.objects;
DROP POLICY IF EXISTS "auth update images-private" ON storage.objects;
DROP POLICY IF EXISTS "auth delete images-private" ON storage.objects;

CREATE POLICY "admin read images-private" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images-private' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write images-private" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images-private' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update images-private" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images-private' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete images-private" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images-private' AND public.has_role(auth.uid(), 'admin'));

-- Storage: images-derived (admin only; public download uses service role)
CREATE POLICY "admin all images-derived" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'images-derived' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'images-derived' AND public.has_role(auth.uid(), 'admin'));

-- Storage: featured-images (keep public read, restrict writes to admin)
DROP POLICY IF EXISTS "auth write featured bucket" ON storage.objects;
CREATE POLICY "admin write featured bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'featured-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'featured-images' AND public.has_role(auth.uid(), 'admin'));
