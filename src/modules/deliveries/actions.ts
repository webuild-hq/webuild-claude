"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { downloadUrl } from "./service";

/** Nouveau lien de téléchargement d'un thème déjà livré (gratuit) : installation manuelle ou réinstallation. */
export async function downloadDelivery(formData: FormData) {
  const deliveryId = String(formData.get("delivery_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase } = await requireUser(`/dashboard/${slug}/shops`);

  // RLS : seule une livraison d'une agence dont l'utilisateur est membre est lisible.
  const { data } = await supabase
    .from("deliveries")
    .select("id, theme_slug, license_salt, license_hash, shops (myshopify_domain)")
    .eq("id", deliveryId)
    .single<{ id: string; theme_slug: string; license_salt: string; license_hash: string; shops: { myshopify_domain: string } }>();
  if (!data) redirect(`/dashboard/${slug}/shops`);

  const { url } = await downloadUrl(await publicOrigin(), {
    id: data.id,
    theme_slug: data.theme_slug,
    license_salt: data.license_salt,
    license_hash: data.license_hash,
    myshopify_domain: data.shops.myshopify_domain,
  });
  redirect(url);
}
