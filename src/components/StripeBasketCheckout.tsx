import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createBasketCheckoutSession } from "@/lib/payments.functions";

interface BasketCheckoutProps {
  items: Array<{ priceId: string; quantity: number }>;
  customerEmail?: string;
  userId?: string;
  imageIds?: string[];
  returnUrl?: string;
}

export function StripeBasketCheckout({
  items,
  customerEmail,
  userId,
  imageIds,
  returnUrl,
}: BasketCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const secret = await createBasketCheckoutSession({
      data: {
        items,
        customerEmail,
        userId,
        imageIds,
        returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if (!secret) throw new Error("Failed to create checkout session");
    return secret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
