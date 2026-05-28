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
  agentCode?: string;
}

export function StripeBasketCheckout({
  items,
  customerEmail,
  userId,
  imageIds,
  imageTiers,
  returnUrl,
  agentCode,
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
          agentCode,
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
  }, [customerEmail, imageIds, imageTiers, items, returnUrl, userId, agentCode]);

  // getStripe() throws if the payment token isn't configured for this
  // environment (the published site before go-live). Catch it so a payments
  // misconfiguration can't crash the whole basket page.
  let stripePromise: ReturnType<typeof getStripe> | null = null;
  try {
    stripePromise = getStripe();
  } catch {
    stripePromise = null;
  }

  if (!stripePromise) {
    return (
      <div style={{
        padding: "32px 24px",
        textAlign: "center",
        fontSize: 14,
        lineHeight: 1.5,
        color: "#8a4a00",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}>
        Checkout is temporarily unavailable.<br />
        Please try again later or contact us to complete your purchase.
      </div>
    );
  }

  return (
    <div id="checkout">
      {error && <div className="lb-checkout-error">{error}</div>}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
