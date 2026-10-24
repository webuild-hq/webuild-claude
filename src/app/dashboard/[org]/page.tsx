import Link from "next/link";
import { ROLE_LABELS } from "@/modules/organizations/types";
import { getCreditBalance, getOrganizationPlan } from "@/modules/billing/queries";
import { listShops } from "@/modules/deliveries/service";
import { listMembers } from "@/modules/organizations/queries";
import { getTheme } from "@/modules/themes/catalog";
import { Card, EmptyState, formatDate, formatNumber, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";
import { loadOrganization } from "./context";

export default async function OrganizationOverview({ params, searchParams }: PageProps<"/dashboard/[org]">) {
  const { org: slug } = await params;
  const { password } = await searchParams;
  const { supabase, organization } = await loadOrganization(slug);
  const [credits, plan, shops, members] = await Promise.all([
    getCreditBalance(supabase, organization.id),
    getOrganizationPlan(supabase, organization.id),
    listShops(supabase, organization.id),
    listMembers(supabase, organization.id),
  ]);
  const deliveries = shops
    .flatMap((shop) => shop.deliveries.map((d) => ({ ...d, domain: shop.domain })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const base = `/dashboard/${slug}`;

  return (
    <>
      <PageHeader title={organization.name} description={`Ton rôle : ${ROLE_LABELS[organization.role]}`} />
      {password === "updated" && <Notice tone="success">Mot de passe mis à jour.</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Crédits" value={formatNumber(credits)} hint="Voir l'historique" href={`${base}/credits`} />
        <Stat label="Plan" value={plan.name} hint={`${formatNumber(plan.monthlyCredits)} crédits par mois`} href={`${base}/billing`} />
        <Stat label="Boutiques" value={shops.length} hint="Thèmes livrés" href={`${base}/shops`} />
        <Stat label="Membres" value={`${members.length} / ${plan.maxMembers}`} hint="Places utilisées" href={`${base}/members`} />
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-semibold">Construire une boutique avec Claude</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>
            <Link href={`${base}/claude`} className="underline">Connecte Webuild à Claude</Link>, avec le connecteur
            Shopify déjà branché.
          </li>
          <li>
            Choisis un <Link href={`${base}/themes`} className="underline">thème</Link> avec ton client.
          </li>
          <li>
            Demande à Claude : <em>&laquo; Construis une boutique premium avec un thème Webuild sur ma boutique
            Shopify, avec les images adaptées à chaque section. &raquo;</em>
          </li>
        </ol>
        <div>
          <LinkButton href={`${base}/claude`}>Connecter Claude</LinkButton>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Dernières livraisons</h2>
        {deliveries.length === 0 ? (
          <EmptyState title="Aucun thème livré pour l'instant">
            Les thèmes installés par Claude apparaissent ici, avec leur boutique et leur licence.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-border">
            {deliveries.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium">{getTheme(d.themeSlug)?.name ?? d.themeSlug}</span>
                <span className="text-muted">{d.domain}</span>
                <span className="text-muted">{formatDate(d.createdAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
