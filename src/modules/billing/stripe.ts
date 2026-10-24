import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "./queries";

/**
 * Prix Stripe d'un plan, retrouvé par sa lookup_key ou créé à la volée.
 * Changer le prix d'un plan en base crée automatiquement un nouveau prix Stripe.
 */
export async function ensurePlanPrice(plan: Plan): Promise<string> {
  const lookupKey = `webuild_${plan.id}_${plan.priceCents}_${plan.currency}_monthly`;
  const existing = await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const price = await stripe().prices.create({
    currency: plan.currency,
    unit_amount: plan.priceCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: { plan_id: plan.id },
    product_data: { name: `Webuild ${plan.name}`, metadata: { plan_id: plan.id } },
  });
  return price.id;
}

function planIdOf(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  return price?.metadata?.plan_id ?? null;
}

function periodEndOf(subscription: Stripe.Subscription): string | null {
  const end = subscription.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

/** Recopie l'état d'un abonnement Stripe dans la table subscriptions. */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organization_id;
  if (!organizationId) return;

  const admin = createAdminClient();
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
  const { error } = await admin.from("subscriptions").upsert({
    organization_id: organizationId,
    plan_id: ended ? "free" : (planIdOf(subscription) ?? "free"),
    status: subscription.status,
    stripe_customer_id: idOf(subscription.customer),
    stripe_subscription_id: ended ? null : subscription.id,
    current_period_end: periodEndOf(subscription),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Facture payée : crédite l'agence des crédits mensuels de son plan (une seule fois par facture). */
export async function grantInvoiceCredits(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;

  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  const organizationId = subscription.metadata?.organization_id;
  const planId = planIdOf(subscription);
  if (!organizationId || !planId) return;

  const admin = createAdminClient();
  const { data: plan } = await admin.from("plans").select("name, monthly_credits").eq("id", planId).single();
  if (!plan || plan.monthly_credits <= 0) return;

  const { error } = await admin.rpc("grant_credits", {
    org: organizationId,
    credit_amount: plan.monthly_credits,
    credit_reason: "subscription",
    details: `Abonnement ${plan.name}`,
    idempotency: `invoice:${invoice.id}`,
  });
  if (error) throw error;
  await syncSubscription(subscription);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      if (subscriptionId) await syncSubscription(await stripe().subscriptions.retrieve(subscriptionId));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
      break;
    case "invoice.paid":
      await grantInvoiceCredits(event.data.object);
      break;
  }
}
