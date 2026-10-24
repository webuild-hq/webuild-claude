import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Client Supabase "serveur" (clé secrète) : contourne RLS. À réserver aux traitements que seul
 * le serveur peut décider, comme les webhooks Stripe ou le remboursement d'une image ratée.
 * Ne jamais l'utiliser pour une action qu'un utilisateur demande directement.
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
