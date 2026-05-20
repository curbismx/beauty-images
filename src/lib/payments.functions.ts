import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, ensureLicenseTaxCodes } from "@/lib/stripe.server";

type LineItemInput = { priceId: string; quantity: number };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createBasketCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    items: LineItemInput[];
    customerEmail?: string;
    userId?: string;
    imageIds?: string[];
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("No items");
    }
    for (const it of data.items) {
      if (!/^[a-zA-Z0-9_-]+$/.test(it.priceId)) throw new Error("Invalid priceId");
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 100) {
        throw new Error("Invalid quantity");
      }
    }
    return data;
  })
  .handler(async ({ data }) => {
    const stripe = createStripeClient(data.environment);

    // Ensure products have a tax code (idempotent, runs once per process).
    await ensureLicenseTaxCodes(stripe);

    // Resolve human-readable price IDs to Stripe price objects via lookup_keys.
    const lookupKeys = Array.from(new Set(data.items.map((i) => i.priceId)));
    const prices = await stripe.prices.list({ lookup_keys: lookupKeys, limit: 100 });
    const priceByKey = new Map<string, string>();
    for (const p of prices.data) {
      if (p.lookup_key) priceByKey.set(p.lookup_key, p.id);
    }
    const line_items = data.items.map((it) => {
      const stripePriceId = priceByKey.get(it.priceId);
      if (!stripePriceId) throw new Error(`Price not found: ${it.priceId}`);
      return { price: stripePriceId, quantity: it.quantity };
    });

    const customerId = (data.customerEmail || data.userId)
      ? await resolveOrCreateCustomer(stripe, {
          email: data.customerEmail,
          userId: data.userId,
        })
      : undefined;

    const description = `BEAUTYIMAGES license purchase (${data.items.reduce((s, i) => s + i.quantity, 0)} item${data.items.reduce((s, i) => s + i.quantity, 0) === 1 ? "" : "s"})`;

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      payment_intent_data: { description },
      managed_payments: { enabled: true },
      metadata: {
        ...(data.userId && { userId: data.userId }),
        ...(data.imageIds && data.imageIds.length > 0 && {
          imageIds: data.imageIds.slice(0, 50).join(","),
        }),
      },
    } as any);

    return session.client_secret;
  });
