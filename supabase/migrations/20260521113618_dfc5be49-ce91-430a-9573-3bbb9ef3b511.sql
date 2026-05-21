ALTER TABLE public.images ALTER COLUMN image_number DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.images_image_number_seq;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS processing_error text;
CREATE INDEX IF NOT EXISTS images_preview_path_null_idx ON public.images (image_number) WHERE preview_path IS NULL;
CREATE INDEX IF NOT EXISTS images_keyworded_null_idx ON public.images (image_number) WHERE keyworded_at IS NULL;