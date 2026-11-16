-- People only. Robots, crawlers, link previewers, monitors and scripts
-- were being counted as visitors; from now on the tracker turns them away,
-- and the ones already recorded are marked so every figure leaves them out.
-- The pattern is the same one the tracker uses.

ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

UPDATE public.visitors
SET is_bot = true
WHERE user_agent IS NULL OR user_agent = '' OR user_agent ~* 'bot|crawl|spider|slurp|preview|fetch|scan|monitor|archive|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|skype|vkshare|pinterest|headless|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|go-http|node-fetch|axios|java/|libwww|scrapy|aiohttp|ruby|perl|php|anthropic|bytespider|meta-externalagent|perplexity|cohere|chatgpt-user|ahrefs|semrush|yandex|baidu|pingdom|statuscake|checkly|gtmetrix|dataprovider|netcraft|qualys|censys|shodan|nmap|masscan|zgrab|nuclei|sqlmap|nikto';

CREATE INDEX IF NOT EXISTS visitors_is_bot ON public.visitors (is_bot);

-- The admin's figures, now counting people only (the function is otherwise as before).
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
  WHERE NOT v.is_bot
),
pv AS (
  SELECT v.ip, v.visit_date, v.country, v.referer
  FROM public.visitors v CROSS JOIN r
  WHERE v.visit_date >= r.start_day AND NOT v.is_bot
),
views AS (
  SELECT p.ip, coalesce(nullif(p.path, ''), '/') AS path
  FROM public.page_views p CROSS JOIN r
  WHERE p.created_at >= r.start_day::timestamp AT TIME ZONE 'utc'
    AND NOT EXISTS (SELECT 1 FROM public.visitors b WHERE b.ip = p.ip AND b.is_bot)
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
