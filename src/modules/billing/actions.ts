"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { getMyOrganization } from "@/modules/organizations/queries";
import { canManageMembers } from "@/modules/organizations/types";
import { getSubscription, listPlans } from "./queries";
import { ensurePlanPrice } from "./stripe";

/** Démarre un abonnement (Stripe Checkout), ou ouvre le portail si l'agence est déjà abonnée. */
export async function startCheckout(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const planId = String(formData.get("plan_id") ?? "");
  const { supabase, user } = await requireUser(`/dashboard/${slug}/billing`);
  const billingUrl = `/dashboard/${slug}/billing`;

  const organization = await getMyOrganization(supabase, user.id, slug);
  if (!organization || !canManageMembers(organization.role)) redirect(`${billingUrl}?error=forbidden`);
  if (!isStripeConfigured()) redirect(`${billingUrl}?error=stripe`);

  const plan = (await listPlans(supabase)).find((p) => p.id === planId && p.priceCents > 0);
  if (!plan) redirect(`${billingUrl}?error=plan`);

  const subscription = await getSubscription(supabase, organization.id);
  const origin = await publicOrigin();

  let destination: string;
  try {
    if (subscription?.stripeCustomerId && subscription.planId !== "free" && subscription.status !== "canceled") {
      const portal = await stripe().billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${origin}${billingUrl}`,
      });
      destination = portal.url;
    } else {
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: await ensurePlanPrice(plan), quantity: 1 }],
        ...(subscription?.stripeCustomerId
          ? { customer: subscription.stripeCustomerId }
          : { customer_email: user.email ?? undefined }),
        client_reference_id: organization.id,
        metadata: { organization_id: organization.id },
        subscription_data: { metadata: { organization_id: organization.id } },
        allow_promotion_codes: true,
        success_url: `${origin}${billingUrl}?success=1`,
        cancel_url: `${origin}${billingUrl}`,
      });
      destination = session.url!;
    }
  } catch (error) {
    console.error("[stripe] checkout", error);
    redirect(`${billingUrl}?error=checkout`);
  }
  redirect(destination);
}

/** Portail client Stripe : factures, moyen de paiement, changement de plan, résiliation. */
export async function openBillingPortal(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { supabase, user } = await requireUser(`/dashboard/${slug}/billing`);
  const billingUrl = `/dashboard/${slug}/billing`;

  const organization = await getMyOrganization(supabase, user.id, slug);
  if (!organization || !canManageMembers(organization.role)) redirect(`${billingUrl}?error=forbidden`);
  const subscription = await getSubscription(supabase, organization.id);
  if (!isStripeConfigured() || !subscription?.stripeCustomerId) redirect(`${billingUrl}?error=stripe`);

  let destination: string;
  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${await publicOrigin()}${billingUrl}`,
    });
    destination = portal.url;
  } catch (error) {
    console.error("[stripe] portail", error);
    redirect(`${billingUrl}?error=checkout`);
  }
  redirect(destination);
}
