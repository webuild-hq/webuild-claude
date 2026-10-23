import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { supabaseAuthIssuer } from "@/lib/env";

export type WebuildAuthExtra = { userId: string; email?: string };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${supabaseAuthIssuer()}/.well-known/jwks.json`));
  return jwks;
}

/**
 * Vérifie un jeton d'accès émis par le serveur OAuth 2.1 de Supabase Auth,
 * avec les clés publiques du projet (signature asymétrique ES256).
 */
export async function verifySupabaseAccessToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  try {
    const { payload } = await jwtVerify(bearerToken, getJwks(), {
      issuer: supabaseAuthIssuer(),
      audience: "authenticated",
    });

    // Seuls les jetons OAuth portent client_id : une session web classique ne doit pas ouvrir le MCP.
    const clientId = typeof payload.client_id === "string" ? payload.client_id : undefined;
    if (!payload.sub || !clientId) return undefined;

    const scope = typeof payload.scope === "string" ? payload.scope : "";
    const extra: WebuildAuthExtra = {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };

    return {
      token: bearerToken,
      clientId,
      scopes: scope.split(" ").filter(Boolean),
      expiresAt: payload.exp,
      extra,
    };
  } catch {
    return undefined;
  }
}
