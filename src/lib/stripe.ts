import { loadStripe, Stripe } from "@stripe/stripe-js";

type StripeEnv = 'sandbox' | 'live';

// Publishable test token: safe to expose client-side and keeps the published
// site testable before the live payments token is provisioned.
const fallbackSandboxClientToken = "pk_test_51TZCmCLKLEDyV3qYL3dQxSsynb7oAH19azUCDT1Z8rk7QvJLiTcGzkdEmj0BvuuBbtRBywkshI1Oi1drU6fxKndk00u3YguJ3f";
const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN || fallbackSandboxClientToken;
const environment: StripeEnv = clientToken?.startsWith('pk_test_') ? 'sandbox' : 'live';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return environment;
}

export function isStripeTestMode(): boolean {
  return clientToken.startsWith("pk_test_");
}
