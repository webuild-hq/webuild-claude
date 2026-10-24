"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Décision de l'utilisateur sur l'écran de consentement : renvoie vers Claude avec un code ou une erreur. */
export async function decide(formData: FormData) {
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const organizationId = String(formData.get("organization_id") ?? "");
  const approve = formData.get("decision") === "approve";
  const supabase = await createClient();

  if (approve) {
    await saveDefaultOrganization(supabase, authorizationId, organizationId);
  }

  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId);

  if (error || !data) {
    const search = new URLSearchParams({ authorization_id: authorizationId, error: "1" });
    redirect(`/oauth/consent?${search.toString()}`);
  }
  redirect(data.redirect_url);
}

/**
 * Mémorise l'agence par défaut pour ce client OAuth. Le client est relu côté serveur
 * (jamais pris dans le formulaire), et RLS refuse une agence dont l'utilisateur n'est pas membre.
 */
async function saveDefaultOrganization(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorizationId: string,
  organizationId: string,
) {
  if (!organizationId) return;
  const [{ data: claims }, { data: details }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.oauth.getAuthorizationDetails(authorizationId),
  ]);
  if (!claims?.claims.sub || !details || !("authorization_id" in details)) return;

  await supabase.from("mcp_connections").upsert({
    user_id: claims.claims.sub,
    oauth_client_id: details.client.id,
    default_organization_id: organizationId,
    updated_at: new Date().toISOString(),
  });
}
