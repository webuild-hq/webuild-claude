import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/modules/billing/stripe";

/** Webhook Stripe : abonnements et crédits mensuels. La signature est vérifiée sur le corps brut. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook non configuré", { status: 400 });
  }

  let event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error("[stripe] échec du traitement", event.type, event.id, error);
    // 500 : Stripe renverra l'événement plus tard.
    return new Response("Erreur de traitement", { status: 500 });
  }
  return Response.json({ received: true });
}
