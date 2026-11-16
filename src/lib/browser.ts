/*
 * What a visitor is reading with, from the browser's own description of
 * itself: a short label such as "Safari on iPhone" or "Chrome on Windows",
 * and whether it is a robot at all. The description is read and dropped;
 * only the label is kept.
 */

/** Robots, crawlers, link previewers, monitors and scripts: not people. */
export const BOTS =
  /bot|crawl|spider|slurp|preview|fetch|scan|monitor|archive|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|skype|vkshare|pinterest|headless|lighthouse|pagespeed|phantomjs|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|go-http|node-fetch|axios|java\/|libwww|scrapy|aiohttp|ruby|perl|php|anthropic|bytespider|meta-externalagent|perplexity|cohere|chatgpt-user|ahrefs|semrush|yandex|baidu|pingdom|statuscake|checkly|gtmetrix|dataprovider|netcraft|qualys|censys|shodan|nmap|masscan|zgrab|nuclei|sqlmap|nikto/i;

/** True when the description is a robot's, or there is none. */
export function isBot(agent: string | null | undefined): boolean {
  return !agent || BOTS.test(agent);
}

/** "Safari on iPhone", "Chrome on Windows", "Instagram app on Android"; null when there is nothing to go on. */
export function browserLabel(agent: string | null | undefined): string | null {
  if (!agent) return null;
  const ua = agent;
  const has = (re: RegExp) => re.test(ua);

  const device = has(/iPhone/)
    ? "iPhone"
    : has(/iPad/)
      ? "iPad"
      : has(/Android/)
        ? "Android"
        : has(/Windows/)
          ? "Windows"
          : has(/CrOS/)
            ? "Chromebook"
            : has(/Macintosh|Mac OS X/)
              ? "Mac"
              : has(/Linux/)
                ? "Linux"
                : null;

  // In-app browsers first: they carry the real browser's name too.
  const browser = has(/Instagram/)
    ? "Instagram app"
    : has(/FBAN|FBAV|FB_IAB/)
      ? "Facebook app"
      : has(/LinkedInApp/)
        ? "LinkedIn app"
        : has(/GSA\//)
          ? "Google app"
          : has(/Edg(e|A|iOS)?\//)
            ? "Edge"
            : has(/OPR\/|Opera/)
              ? "Opera"
              : has(/SamsungBrowser/)
                ? "Samsung Internet"
                : has(/Firefox\/|FxiOS/)
                  ? "Firefox"
                  : has(/CriOS|Chrome\//)
                    ? "Chrome"
                    : has(/Version\/.*Safari\//)
                      ? "Safari"
                      : has(/AppleWebKit/) && (device === "iPhone" || device === "iPad")
                        ? "App"
                        : has(/Safari\//)
                          ? "Safari"
                          : null;

  if (!browser && !device) return "Other";
  if (!browser) return device;
  if (!device) return browser;
  return `${browser} on ${device}`;
}
