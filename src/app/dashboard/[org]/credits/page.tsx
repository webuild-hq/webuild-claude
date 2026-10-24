import {
  getCreditBalance,
  getOrganizationPlan,
  listCreditPrices,
  listCreditTransactions,
  REASON_LABELS,
} from "@/modules/billing/queries";
import { Card, EmptyState, formatDateTime, formatNumber, LinkButton, PageHeader, Stat } from "@/components/ui";
import { loadOrganization } from "../context";

export const metadata = { title: "Crédits | Webuild" };

export default async function CreditsPage({ params }: PageProps<"/dashboard/[org]/credits">) {
  const { org: slug } = await params;
  const { supabase, organization } = await loadOrganization(slug, "/credits");
  const [balance, plan, prices, transactions] = await Promise.all([
    getCreditBalance(supabase, organization.id),
    getOrganizationPlan(supabase, organization.id),
    listCreditPrices(supabase),
    listCreditTransactions(supabase, organization.id, 100),
  ]);

  return (
    <>
      <PageHeader
        title="Crédits"
        description="Chaque installation de thème et chaque image générée consomme des crédits de l'agence."
        actions={<LinkButton href={`/dashboard/${slug}/billing`} variant="secondary">Changer de plan</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Solde" value={formatNumber(balance)} hint="crédits disponibles" />
        <Stat label="Plan" value={plan.name} hint={`${formatNumber(plan.monthlyCredits)} crédits ajoutés chaque mois`} />
        <Card className="flex flex-col gap-2 p-5">
          <span className="text-sm text-muted">Tarifs</span>
          {prices.map((price) => (
            <div key={price.action} className="flex justify-between gap-2 text-sm">
              <span>{price.label}</span>
              <span className="font-medium">{formatNumber(price.credits)}</span>
            </div>
          ))}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Historique</h2>
        {transactions.length === 0 ? (
          <EmptyState title="Aucune opération" />
        ) : (
          <Card className="divide-y divide-border">
            {transactions.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="w-36 text-muted">{formatDateTime(t.createdAt)}</span>
                <span className="font-medium">{REASON_LABELS[t.reason] ?? t.reason}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{t.description}</span>
                <span className={`font-medium tabular-nums ${t.amount >= 0 ? "text-success" : ""}`}>
                  {t.amount > 0 ? "+" : ""}
                  {formatNumber(t.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
