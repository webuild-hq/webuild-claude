import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Client Supabase "serveur" (clé secrète) : contourne RLS. À réserver aux traitements sans
 * utilisateur, comme les webhooks Stripe. Ne jamais l'utiliser pour une action d'un utilisateur.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Variable d'environnement manquante : SUPABASE_SECRET_KEY");
  }
  return createClient(supabaseUrl(), secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
