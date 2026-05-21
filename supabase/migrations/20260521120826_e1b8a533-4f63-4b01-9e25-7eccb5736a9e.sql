ALTER TABLE public.images ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_images_processing_started_at ON public.images(processing_started_at);