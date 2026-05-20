import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

const TIER_FROM_CODE: Record<string, string> = { s: "small", m: "medium", l: "large" };

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.userId || null;
  const imageIds: string[] = session.metadata?.imageIds
    ? String(session.metadata.imageIds).split(",").filter(Boolean)
    : [];

  // Parse "id:s,id:m,id:l" into ordered (imageId, tier) pairs.
  const tierPairs: Array<{ id: string; tier: string }> = [];
  if (session.metadata?.imageTiers) {
    for (const pair of String(session.metadata.imageTiers).split(",")) {
      const [id, code] = pair.split(":");
      const tier = TIER_FROM_CODE[(code || "").toLowerCase()];
      if (id && tier) tierPairs.push({ id, tier });
    }
  }

  const amountTotal = (session.amount_total ?? 0) / 100;
  const currency = (session.currency || "gbp").toUpperCase();
  const paymentId = session.payment_intent || session.id;
  const sessionId = session.id;

  const pricePerLine = tierPairs.length > 0
    ? amountTotal / tierPairs.length
    : (imageIds.length > 0 ? amountTotal / imageIds.length : amountTotal);

  // Prefer one row per (image, tier) line so each licence is independent.
  const rows = tierPairs.length > 0
    ? tierPairs.map((p) => ({
        image_id: p.id,
        user_id: userId,
        amount: pricePerLine,
        currency,
        status: "completed" as const,
        stripe_payment_id: paymentId,
        stripe_session_id: sessionId,
        download_tier: p.tier,
      }))
    : imageIds.map((image_id) => ({
        image_id,
        user_id: userId,
        amount: pricePerLine,
        currency,
        status: "completed" as const,
        stripe_payment_id: paymentId,
        stripe_session_id: sessionId,
        download_tier: "medium",
      }));

  if (rows.length === 0) {
    const { error } = await getSupabase().from("sales").insert({
      user_id: userId,
      amount: amountTotal,
      currency,
      status: "completed",
      stripe_payment_id: paymentId,
      stripe_session_id: sessionId,
    });
    if (error) console.error("Failed to insert sale row:", error);
    return;
  }

  const { error } = await getSupabase().from("sales").insert(rows);
  if (error) console.error("Failed to insert sales rows:", error);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed":
    case "transaction.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
