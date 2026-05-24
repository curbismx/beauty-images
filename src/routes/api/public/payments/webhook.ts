import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { sendTransactionalEmail } from "@/lib/email/send-transactional.server";

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
const ROOT_DOMAIN = "beautyimages.com";

async function sendOrderConfirmationEmail(
  sessionId: string,
  recipientEmail: string,
) {
  const supabase = getSupabase();

  // Pull the order rows we just inserted to build the email summary
  const { data: sales } = await supabase
    .from("sales")
    .select("image_id, download_tier, amount, currency")
    .eq("stripe_session_id", sessionId);

  if (!sales || sales.length === 0) return;

  const imageIds = Array.from(new Set(sales.map((s: any) => s.image_id).filter(Boolean))) as string[];
  const { data: images } = await supabase
    .from("images")
    .select("id, image_number, title")
    .in("id", imageIds);

  const imgMap = new Map<string, any>();
  for (const im of images ?? []) imgMap.set(im.id, im);

  let total = 0;
  const items = sales.map((s: any) => {
    const im = imgMap.get(s.image_id);
    const price = Number(s.amount) || 0;
    total += price;
    return {
      image_number: im?.image_number,
      title: im?.title,
      tier: s.download_tier || "medium",
      price,
    };
  });

  const currency = (sales[0] as any).currency || "GBP";
  const downloadUrl = `https://${ROOT_DOMAIN}/checkout/return?session_id=${encodeURIComponent(sessionId)}`;

  const result = await sendTransactionalEmail({
    supabase,
    templateName: "order-confirmation",
    recipientEmail,
    idempotencyKey: `order-confirm-${sessionId}`,
    templateData: {
      siteName: "BEAUTYIMAGES",
      downloadUrl,
      total,
      currency,
      items,
    },
  });

  if (!result.success) {
    console.warn("Order confirmation email not sent", { sessionId, reason: result.reason });
  }
}

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
  } else {
    const { error } = await getSupabase().from("sales").insert(rows);
    if (error) console.error("Failed to insert sales rows:", error);
  }

  // Send order confirmation email (best-effort — never block the webhook ack)
  const recipientEmail: string | undefined =
    session.customer_details?.email || session.customer_email;
  if (recipientEmail) {
    try {
      await sendOrderConfirmationEmail(sessionId, recipientEmail);
    } catch (err) {
      console.error("Order confirmation email error", err);
    }
  } else {
    console.warn("No recipient email on Stripe session, skipping confirmation", { sessionId });
  }
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
