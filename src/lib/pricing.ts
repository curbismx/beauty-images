import { useEffect, useState } from "react";
import { detectCountry, getCachedCountry, regionFromCountry, type PricingRegion } from "./region";

export type Tier = "small" | "medium" | "large";

export interface TierPricing {
  amount: number; // major units
  currency: "GBP" | "USD";
  symbol: "£" | "$";
  priceId: string;
}

const UK_PRICING: Record<Tier, TierPricing> = {
  small:  { amount: 95,  currency: "GBP", symbol: "£", priceId: "license_small_gbp"  },
  medium: { amount: 195, currency: "GBP", symbol: "£", priceId: "license_medium_gbp" },
  large:  { amount: 275, currency: "GBP", symbol: "£", priceId: "license_large_gbp"  },
};

const ROW_PRICING: Record<Tier, TierPricing> = {
  small:  { amount: 150, currency: "USD", symbol: "$", priceId: "license_small_usd"  },
  medium: { amount: 275, currency: "USD", symbol: "$", priceId: "license_medium_usd" },
  large:  { amount: 375, currency: "USD", symbol: "$", priceId: "license_large_usd"  },
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
