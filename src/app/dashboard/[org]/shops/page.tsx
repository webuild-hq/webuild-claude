import { listShops } from "@/modules/deliveries/service";
import { downloadDelivery } from "@/modules/deliveries/actions";
import { getTheme } from "@/modules/themes/catalog";
import { Button, Card, EmptyState, formatDate, PageHeader } from "@/components/ui";
import { loadOrganization } from "../context";

export const metadata = { title: "Boutiques | Webuild" };

export default async function ShopsPage({ params }: PageProps<"/dashboard/[org]/shops">) {
  const { org: slug } = await params;
  const { supabase, organization } = await loadOrganization(slug, "/shops");
  const shops = await listShops(supabase, organization.id);

  return (
    <>
      <PageHeader
        title="Boutiques"
        description="Boutiques Shopify pour lesquelles un thème a été livré. Chaque licence est liée au domaine myshopify.com et valable à vie."
      />
      {shops.length === 0 ? (
        <EmptyState title="Aucune boutique pour l'instant">
          Demande à Claude d&apos;installer un thème Webuild sur une boutique : elle apparaîtra ici automatiquement.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {shops.map((shop) => (
            <Card key={shop.id} className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a
                  href={`https://${shop.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold hover:underline"
                >
                  {shop.name ?? shop.domain}
                </a>
                <span className="text-xs text-muted">Ajoutée le {formatDate(shop.createdAt)}</span>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {shop.deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-medium">{getTheme(delivery.themeSlug)?.name ?? delivery.themeSlug}</span>
                    <span className="text-muted">v{delivery.themeVersion}</span>
                    <span className="text-muted">Livré le {formatDate(delivery.createdAt)}</span>
                    <form action={downloadDelivery} className="ml-auto">
                      <input type="hidden" name="delivery_id" value={delivery.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <Button type="submit" variant="secondary" className="py-1.5">
                        Télécharger le zip
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
