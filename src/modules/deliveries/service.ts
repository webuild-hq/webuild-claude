import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTheme } from "@/modules/themes/catalog";
import { buildThemeZip } from "@/modules/themes/package";

/** Bucket privé des zips livrés (migration 0004) : seul le serveur y lit et écrit. */
export const DELIVERIES_BUCKET = "theme-deliveries";

/** Durée de validité du lien : Shopify télécharge le zip de façon asynchrone après themeCreate. */
export const DOWNLOAD_TTL_SECONDS = 60 * 60;

/** Vrai si les zips peuvent être déposés et signés. À vérifier avant de débiter une livraison. */
export function isDownloadConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

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

/**
 * Construit le zip verrouillé d'une livraison, le dépose dans Supabase Storage et renvoie un lien signé.
 * themeCreate refuse le zip servi directement par l'app ("Src is empty") mais accepte un lien de CDN.
 */
export async function downloadUrl(
  appOrigin: string,
  delivery: Pick<DeliveryRow, "id" | "myshopify_domain" | "theme_slug" | "license_salt" | "license_hash">,
) {
  const zip = await buildThemeZip(delivery.theme_slug, {
    salt: delivery.license_salt,
    hash: delivery.license_hash,
    appOrigin,
  });

  // Un seul fichier par livraison, remplacé à chaque demande (le lien d'origine de la licence peut changer).
  const path = `${delivery.id}/${delivery.theme_slug}-${delivery.myshopify_domain.split(".")[0]}.zip`;
  const storage = createAdminClient().storage.from(DELIVERIES_BUCKET);
  const { error: uploadError } = await storage.upload(path, zip, { contentType: "application/zip", upsert: true });
  if (uploadError) throw uploadError;

  const { data, error } = await storage.createSignedUrl(path, DOWNLOAD_TTL_SECONDS);
  if (error || !data) throw error ?? new Error("Lien signé non créé");

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString(),
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
  // Vérifié avant create_delivery : sans dépôt possible du zip, aucun crédit ne doit être débité.
  if (!isDownloadConfigured()) {
    console.error("[themes] SUPABASE_SECRET_KEY manquante : installation refusée avant débit");
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

  // La livraison est enregistrée : si le dépôt échoue, un nouvel appel est gratuit pour la même boutique.
  try {
    return { delivery: data, theme, download: await downloadUrl(params.appOrigin, data) } as const;
  } catch (cause) {
    console.error("[themes] dépôt du zip impossible", data.id, cause);
    return { error: { message: "download_failed" } } as const;
  }
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
