import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, createStripeClient, ensureLicenseTaxCodes } from "@/lib/stripe.server";

type LineItemInput = { priceId: string; quantity: number };

const AGENT_CODE_RE = /^[A-Z0-9]{3,8}$/;

// Re-create or reuse a single Stripe coupon per discount percentage.
// Deterministic id (agent_pct_10) means it is created once and reused for
// every agent on that rate.
async function ensurePercentCoupon(
  stripe: ReturnType<typeof createStripeClient>,
  pct: number,
): Promise<string> {
  const id = `agent_pct_${pct}`;
  try {
    await stripe.coupons.retrieve(id);
  } catch {
    await stripe.coupons.create({
      id,
      percent_off: pct,
      duration: "once",
      name: `Agent referral ${pct}%`,
    } as any);
  }
  return id;
}

// Server-side re-validation of an agent code. Never trust the client's claim
// about the discount — look it up fresh here.
async function lookupAgent(
  code: string,
): Promise<{ id: string; code: string; discount_pct: number } | null> {
  if (!AGENT_CODE_RE.test(code)) return null;
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await supabase
    .from("agents")
    .select("id, code, discount_pct, active")
    .eq("code", code)
    .maybeSingle();
  if (!data || data.active !== true) return null;
  return { id: data.id, code: data.code, discount_pct: Number(data.discount_pct) || 0 };
}

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
    imageTiers?: string;
    returnUrl: string;
    environment: StripeEnv;
    agentCode?: string;
  }) => {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("No items");
    }
    if (data.agentCode) {
      data.agentCode = String(data.agentCode).trim().toUpperCase();
      if (!AGENT_CODE_RE.test(data.agentCode)) {
        // Ignore malformed codes rather than blocking the whole checkout.
        data.agentCode = undefined;
      }
    }
    for (const it of data.items) {
      if (!/^[a-zA-Z0-9_-]+$/.test(it.priceId)) throw new Error("Invalid priceId");
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 100) {
        throw new Error("Invalid quantity");
      }
    }
    if (data.imageTiers && data.imageTiers.length > 450) {
      // Stripe metadata values cap at 500 chars; truncate at id boundary.
      data.imageTiers = data.imageTiers.slice(0, 450).replace(/,[^,]*$/, "");
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

    const agent = data.agentCode ? await lookupAgent(data.agentCode) : null;
    const couponId =
      agent && agent.discount_pct > 0
        ? await ensurePercentCoupon(stripe, agent.discount_pct)
        : null;

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      ...(customerId && { customer: customerId }),
      ...(couponId && { discounts: [{ coupon: couponId }] }),
      payment_intent_data: { description },
      managed_payments: { enabled: true },
      metadata: {
        managed_payments: "true",
        ...(data.userId && { userId: data.userId }),
        ...(data.imageIds && data.imageIds.length > 0 && {
          imageIds: data.imageIds.slice(0, 50).join(","),
        }),
        ...(data.imageTiers && { imageTiers: data.imageTiers }),
        ...(agent && {
          agent_id: agent.id,
          agent_code: agent.code,
          agent_discount_pct: String(agent.discount_pct),
        }),
      },
    } as any);

    return session.client_secret;
  });
