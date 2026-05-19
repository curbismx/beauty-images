
ALTER TABLE public.images
  ADD COLUMN IF NOT EXISTS image_number bigserial,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS keyworded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS images_image_number_key ON public.images(image_number);
CREATE INDEX IF NOT EXISTS images_keyworded_at_idx ON public.images(keyworded_at);
