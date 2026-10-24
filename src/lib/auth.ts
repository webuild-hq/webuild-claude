import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** Utilisateur connecté, ou redirection vers la connexion (avec retour vers `next`). */
export async function requireUser(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const user: CurrentUser = {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
  return { supabase, user };
}
