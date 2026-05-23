import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useCallback, useState } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBasketCheckoutSession } from "@/lib/payments.functions";

interface BasketCheckoutProps {
  items: Array<{ priceId: string; quantity: number }>;
  customerEmail?: string;
  userId?: string;
  imageIds?: string[];
  imageTiers?: string;
  returnUrl?: string;
}

export function StripeBasketCheckout({
  items,
  customerEmail,
  userId,
  imageIds,
  imageTiers,
  returnUrl,
}: BasketCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
      const secret = await createBasketCheckoutSession({
        data: {
          items,
          customerEmail,
          userId,
          imageIds,
          imageTiers,
          returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if (!secret) throw new Error("Failed to create checkout session");
      return secret;
    } catch (err) {
      console.error("Checkout session failed", err);
      setError("Checkout could not load. Please close this window and try again.");
      throw err;
    }
  }, [customerEmail, imageIds, imageTiers, items, returnUrl, userId]);

  return (
    <div id="checkout">
      {error && <div className="lb-checkout-error">{error}</div>}
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
