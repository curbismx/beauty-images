CREATE TABLE IF NOT EXISTS public.upload_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  storage_path text,
  error_message text NOT NULL,
  detected_image_number bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all upload_errors" ON public.upload_errors;
CREATE POLICY "admin all upload_errors"
ON public.upload_errors
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS upload_errors_created_at_idx ON public.upload_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS upload_errors_detected_image_number_idx ON public.upload_errors(detected_image_number);

DROP TRIGGER IF EXISTS update_upload_errors_updated_at ON public.upload_errors;
CREATE TRIGGER update_upload_errors_updated_at
BEFORE UPDATE ON public.upload_errors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();