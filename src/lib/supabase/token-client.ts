import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Client Supabase qui agit au nom de l'utilisateur du jeton OAuth (MCP) :
 * toutes les requêtes passent par RLS, exactement comme sur le dashboard.
 */
export function createTokenClient(accessToken: string) {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
