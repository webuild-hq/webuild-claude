"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Décision de l'utilisateur sur l'écran de consentement : renvoie vers Claude avec un code ou une erreur. */
export async function decide(formData: FormData) {
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const approve = formData.get("decision") === "approve";
  const supabase = await createClient();

  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId)
    : await supabase.auth.oauth.denyAuthorization(authorizationId);

  if (error || !data) {
    const search = new URLSearchParams({ authorization_id: authorizationId, error: "1" });
    redirect(`/oauth/consent?${search.toString()}`);
  }
  redirect(data.redirect_url);
}
