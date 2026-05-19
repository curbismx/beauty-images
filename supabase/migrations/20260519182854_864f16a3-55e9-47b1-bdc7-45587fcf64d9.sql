WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY filename ASC) AS rn, count(*) OVER () AS total
  FROM public.featured_images
)
UPDATE public.featured_images f
SET sort_order = (o.total - o.rn + 1)
FROM ordered o
WHERE f.id = o.id;