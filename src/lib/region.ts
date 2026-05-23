// Detects visitor country via Cloudflare's trace endpoint.
// Returns ISO 3166-1 alpha-2 (e.g. "GB", "US") or null.

const KEY = "bi_country_code";

let inflight: Promise<string | null> | null = null;

export function getCachedCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function detectCountry(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const cached = getCachedCountry();
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch("https://www.cloudflare.com/cdn-cgi/trace", { cache: "no-store" })
    .then((r) => r.text())
    .then((txt) => {
      const m = txt.match(/^loc=([A-Z]{2})/m);
      const code = m ? m[1] : null;
      if (code) {
        try { window.sessionStorage.setItem(KEY, code); } catch {}
      }
      return code;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

export type PricingRegion = "uk" | "row";

export function regionFromCountry(country: string | null): PricingRegion {
  return country === "GB" ? "uk" : "row";
}
