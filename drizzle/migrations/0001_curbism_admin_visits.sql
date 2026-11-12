-- Visit figures for the Curbism admin, worked out in the database so every
-- visit is counted (the API only hands back 1,000 rows at a time).
-- The four headline figures match the Beauty Images dashboard exactly:
-- unique visitors today, in the last 7 days, the last 30 days and all time.
-- p_days sets the period for the chart and the lists (1, 7, 30 or 365).

CREATE OR REPLACE FUNCTION public.curbism_visits(p_days integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
WITH b AS (
  SELECT
    (now() AT TIME ZONE 'utc')::date AS today,
    greatest(1, least(coalesce(p_days, 30), 366)) AS n
),
r AS (
  SELECT today, n, today - (n - 1) AS start_day FROM b
),
tiles AS (
  SELECT
    count(DISTINCT v.ip) FILTER (WHERE v.visit_date = r.today) AS today,
    count(DISTINCT v.ip) FILTER (WHERE v.visit_date >= r.today - 7) AS week,
    count(DISTINCT v.ip) FILTER (WHERE v.visit_date >= r.today - 30) AS month,
    count(DISTINCT v.ip) AS all_time,
    min(v.visit_date) AS first_day
  FROM public.visitors v CROSS JOIN r
),
pv AS (
  SELECT v.ip, v.visit_date, v.country, v.referer
  FROM public.visitors v CROSS JOIN r
  WHERE v.visit_date >= r.start_day
),
views AS (
  SELECT p.ip, coalesce(nullif(p.path, ''), '/') AS path
  FROM public.page_views p CROSS JOIN r
  WHERE p.created_at >= r.start_day::timestamp AT TIME ZONE 'utc'
),
daily AS (
  SELECT g::date AS d, (SELECT count(DISTINCT pv.ip) FROM pv WHERE pv.visit_date = g::date) AS n
  FROM r, generate_series(r.start_day, r.today, interval '1 day') AS g
  WHERE r.n <= 31
),
monthly AS (
  SELECT g::date AS d,
    (SELECT count(DISTINCT pv.ip) FROM pv
      WHERE pv.visit_date >= g::date AND pv.visit_date < (g + interval '1 month')::date) AS n
  FROM r, generate_series(date_trunc('month', r.today::timestamp) - interval '11 months',
                          date_trunc('month', r.today::timestamp), interval '1 month') AS g
  WHERE r.n > 31
),
series AS (
  SELECT d, n FROM daily UNION ALL SELECT d, n FROM monthly
),
src AS (
  SELECT
    CASE
      WHEN host IS NULL OR host = '' OR host LIKE '%beautyimages.com' THEN 'Direct'
      ELSE host
    END AS name,
    ip
  FROM (
    SELECT lower(substring(pv.referer FROM '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:www\.)?([^/:?#]+)')) AS host, pv.ip
    FROM pv
  ) x
),
sources AS (
  SELECT name, count(DISTINCT ip) AS n FROM src GROUP BY name ORDER BY n DESC, name LIMIT 50
),
countries AS (
  SELECT coalesce(nullif(trim(pv.country), ''), 'Unknown') AS name, count(DISTINCT pv.ip) AS n
  FROM pv GROUP BY 1 ORDER BY n DESC, name LIMIT 50
),
pages AS (
  SELECT path, count(*) AS views, count(DISTINCT ip) AS visitors
  FROM views GROUP BY path ORDER BY views DESC, path LIMIT 50
)
SELECT jsonb_build_object(
  'tiles', (SELECT jsonb_build_object(
      'today', today, 'week', week, 'month', month, 'allTime', all_time, 'firstDay', first_day
    ) FROM tiles),
  'period', (SELECT jsonb_build_object(
      'days', r.n, 'from', r.start_day, 'to', r.today,
      'granularity', CASE WHEN r.n <= 31 THEN 'day' ELSE 'month' END,
      'visitors', (SELECT count(DISTINCT ip) FROM pv),
      'pageViews', (SELECT count(*) FROM views)
    ) FROM r),
  'series', coalesce((SELECT jsonb_agg(jsonb_build_object('d', d, 'n', n) ORDER BY d) FROM series), '[]'::jsonb),
  'sources', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'n', n) ORDER BY n DESC, name) FROM sources), '[]'::jsonb),
  'countries', coalesce((SELECT jsonb_agg(jsonb_build_object('name', name, 'n', n) ORDER BY n DESC, name) FROM countries), '[]'::jsonb),
  'pages', coalesce((SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views, 'visitors', visitors) ORDER BY views DESC, path) FROM pages), '[]'::jsonb)
);
$fn$;

REVOKE ALL ON FUNCTION public.curbism_visits(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.curbism_visits(integer) TO service_role;
