import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTheme } from "@/modules/themes/catalog";
import { createDownloadToken, isDownloadConfigured } from "@/modules/themes/download-token";

export type DeliveryRow = {
  id: string;
  shop_id: string;
  myshopify_domain: string;
  theme_slug: string;
  theme_version: string;
  license_salt: string;
  license_hash: string;
  credits_charged: number;
  reused: boolean;
  created_at: string;
};

export function downloadUrl(appOrigin: string, delivery: Pick<DeliveryRow, "id" | "myshopify_domain" | "theme_slug" | "license_salt" | "license_hash">) {
  const { token, expiresAt } = createDownloadToken({
    deliveryId: delivery.id,
    theme: delivery.theme_slug,
    shop: delivery.myshopify_domain,
    salt: delivery.license_salt,
    hash: delivery.license_hash,
    appOrigin,
  });
  return {
    url: `${appOrigin}/api/themes/download/${token}/${delivery.theme_slug}.zip`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

/**
 * Livre un thème pour une boutique : enregistre la licence (et débite les crédits la première fois),
 * puis renvoie un lien de téléchargement signé et temporaire.
 */
export async function prepareThemeInstall(
  supabase: SupabaseClient,
  params: { organizationId: string; shopDomain: string; themeSlug: string; appOrigin: string },
) {
  const theme = getTheme(params.themeSlug);
  if (!theme) {
    return { error: { message: "unknown_theme" } } as const;
  }
  // Vérifié avant create_delivery : sans signature possible, aucun crédit ne doit être débité.
  if (!isDownloadConfigured()) {
    console.error("[themes] THEME_DOWNLOAD_SECRET manquant ou trop court : installation refusée avant débit");
    return { error: { message: "download_not_configured" } } as const;
  }

  const { data, error } = await supabase
    .rpc("create_delivery", {
      org: params.organizationId,
      shop_domain: params.shopDomain,
      theme: theme.slug,
      version: theme.version,
    })
    .single<DeliveryRow>();
  if (error || !data) {
    return { error } as const;
  }

  return { delivery: data, theme, download: downloadUrl(params.appOrigin, data) } as const;
}

export type ShopWithDeliveries = {
  id: string;
  domain: string;
  name: string | null;
  createdAt: string;
  deliveries: {
    id: string;
    themeSlug: string;
    themeVersion: string;
    createdAt: string;
    licenseSalt: string;
    licenseHash: string;
  }[];
};

export async function listShops(supabase: SupabaseClient, organizationId: string): Promise<ShopWithDeliveries[]> {
  const { data, error } = await supabase
    .from("shops")
    .select(
      "id, myshopify_domain, name, created_at, deliveries (id, theme_slug, theme_version, created_at, license_salt, license_hash)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((shop) => ({
    id: shop.id,
    domain: shop.myshopify_domain,
    name: shop.name,
    createdAt: shop.created_at,
    deliveries: (shop.deliveries ?? [])
      .map((d: Record<string, string>) => ({
        id: d.id,
        themeSlug: d.theme_slug,
        themeVersion: d.theme_version,
        createdAt: d.created_at,
        licenseSalt: d.license_salt,
        licenseHash: d.license_hash,
      }))
      .sort((a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt)),
  }));
}
