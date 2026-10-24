import { isStripeConfigured } from "@/lib/stripe";
import { formatPrice, getOrganizationPlan, getSubscription, listPlans } from "@/modules/billing/queries";
import { openBillingPortal, startCheckout } from "@/modules/billing/actions";
import { canManageMembers } from "@/modules/organizations/types";
import { Badge, Button, Card, formatDate, formatNumber, Notice, PageHeader } from "@/components/ui";
import { loadOrganization } from "../context";

export const metadata = { title: "Abonnement | Webuild" };

const ERRORS: Record<string, string> = {
  forbidden: "Seuls les propriétaires et admins de l'agence peuvent gérer l'abonnement.",
  stripe: "Le paiement n'est pas encore activé sur ce serveur.",
  plan: "Plan inconnu.",
  checkout: "Le paiement n'a pas pu démarrer. Réessaie dans un instant ; si le problème continue, contacte le support.",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  past_due: "Paiement en retard",
  canceled: "Résilié",
  unpaid: "Impayé",
  incomplete: "Incomplet",
};

export default async function BillingPage({ params, searchParams }: PageProps<"/dashboard/[org]/billing">) {
  const { org: slug } = await params;
  const { success, error } = await searchParams;
  const { supabase, organization } = await loadOrganization(slug, "/billing");
  const [plans, currentPlan, subscription] = await Promise.all([
    listPlans(supabase),
    getOrganizationPlan(supabase, organization.id),
    getSubscription(supabase, organization.id),
  ]);
  const canManage = canManageMembers(organization.role);
  const stripeReady = isStripeConfigured();
  const hasPaidSubscription = Boolean(subscription?.stripeCustomerId && currentPlan.id !== "free");

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="Les crédits du plan sont ajoutés à chaque mois payé. Les crédits non utilisés sont conservés."
        actions={
          hasPaidSubscription && canManage ? (
            <form action={openBillingPortal}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="secondary">Factures et moyen de paiement</Button>
            </form>
          ) : undefined
        }
      />

      {success === "1" && (
        <Notice tone="success">Paiement confirmé. Les crédits seront ajoutés dès la confirmation de Stripe (quelques secondes).</Notice>
      )}
      {typeof error === "string" && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}
      {!stripeReady && <Notice tone="warning">{ERRORS.stripe}</Notice>}
      {!canManage && <Notice>Seuls les propriétaires et admins de l&apos;agence peuvent changer de plan.</Notice>}

      {subscription && currentPlan.id !== "free" && (
        <Card className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <span>
            Plan actuel : <strong>{currentPlan.name}</strong>
          </span>
          <Badge tone={subscription.status === "active" ? "success" : "warning"}>
            {STATUS_LABELS[subscription.status] ?? subscription.status}
          </Badge>
          {subscription.currentPeriodEnd && (
            <span className="text-muted">
              {subscription.cancelAtPeriodEnd ? "Se termine le" : "Prochain renouvellement le"}{" "}
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const current = plan.id === currentPlan.id;
          return (
            <Card key={plan.id} className={`flex flex-col gap-4 p-5 ${current ? "border-foreground" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{plan.name}</span>
                {current && <Badge tone="success">Actuel</Badge>}
              </div>
              <div>
                <span className="text-2xl font-semibold">
                  {plan.priceCents === 0 ? "0 €" : formatPrice(plan.priceCents, plan.currency)}
                </span>
                <span className="text-sm text-muted"> / mois</span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                <li>{formatNumber(plan.monthlyCredits)} crédits par mois</li>
                <li>
                  {plan.maxMembers} membre{plan.maxMembers > 1 ? "s" : ""}
                </li>
                <li>Tous les thèmes</li>
              </ul>
              {plan.priceCents > 0 && !current && (
                <form action={startCheckout} className="mt-auto">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="plan_id" value={plan.id} />
                  <Button type="submit" className="w-full" disabled={!canManage || !stripeReady}>
                    {hasPaidSubscription ? "Changer pour ce plan" : "Choisir"}
                  </Button>
                </form>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
