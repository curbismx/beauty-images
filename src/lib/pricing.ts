import { useEffect, useState } from "react";
import { detectCountry, getCachedCountry, regionFromCountry, type PricingRegion } from "./region";

export type Tier = "small" | "medium" | "large" | "advertising";

export interface TierPricing {
  amount: number; // major units
  currency: "GBP" | "USD";
  symbol: "£" | "$";
  priceId: string;
}

// The amounts here are what the site shows and what the basket adds up. The
// amount actually charged is the Stripe price with the same lookup key, so
// the two must be kept in step: a change here is a change in Stripe too.
const UK_PRICING: Record<Tier, TierPricing> = {
  small:       { amount: 49,  currency: "GBP", symbol: "£", priceId: "license_small_gbp"       },
  medium:      { amount: 99,  currency: "GBP", symbol: "£", priceId: "license_medium_gbp"      },
  large:       { amount: 199, currency: "GBP", symbol: "£", priceId: "license_large_gbp"       },
  advertising: { amount: 799, currency: "GBP", symbol: "£", priceId: "license_advertising_gbp" },
};

const ROW_PRICING: Record<Tier, TierPricing> = {
  small:       { amount: 65,  currency: "USD", symbol: "$", priceId: "license_small_usd"       },
  medium:      { amount: 129, currency: "USD", symbol: "$", priceId: "license_medium_usd"      },
  large:       { amount: 259, currency: "USD", symbol: "$", priceId: "license_large_usd"       },
  advertising: { amount: 999, currency: "USD", symbol: "$", priceId: "license_advertising_usd" },
};

export function pricingFor(region: PricingRegion): Record<Tier, TierPricing> {
  return region === "uk" ? UK_PRICING : ROW_PRICING;
}

export function formatPrice(p: TierPricing): string {
  return `${p.symbol}${p.amount.toFixed(2)}`;
}

export function useRegionPricing(): {
  region: PricingRegion;
  pricing: Record<Tier, TierPricing>;
  ready: boolean;
} {
  const initialCountry = typeof window !== "undefined" ? getCachedCountry() : null;
  const [region, setRegion] = useState<PricingRegion>(regionFromCountry(initialCountry));
  const [ready, setReady] = useState<boolean>(initialCountry !== null);

  useEffect(() => {
    let alive = true;
    detectCountry().then((c) => {
      if (!alive) return;
      setRegion(regionFromCountry(c));
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  return { region, pricing: pricingFor(region), ready };
}
