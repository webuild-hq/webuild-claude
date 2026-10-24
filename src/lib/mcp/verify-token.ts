import "server-only";
import { createRemoteJWKSet, decodeJwt, errors, jwtVerify } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { supabaseAuthIssuer } from "@/lib/env";

export type WebuildAuthExtra = { userId: string; email?: string };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${supabaseAuthIssuer()}/.well-known/jwks.json`));
  return jwks;
}

/** Journalise la raison d'un refus, sans jamais écrire le jeton lui-même. */
function logRejection(reason: string, token?: string) {
  let claims: Record<string, unknown> = {};
  if (token) {
    try {
      const { iss, aud, exp, client_id, sub } = decodeJwt(token);
      claims = { iss, aud, exp, client_id, hasSub: Boolean(sub) };
    } catch {
      claims = { decodable: false };
    }
  }
  console.warn("[mcp-auth] jeton refusé", {
    reason,
    expectedIssuer: supabaseAuthIssuer(),
    ...claims,
  });
}

/**
 * Vérifie un jeton d'accès émis par le serveur OAuth 2.1 de Supabase Auth,
 * avec les clés publiques du projet (signature asymétrique ES256).
 */
export async function verifySupabaseAccessToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    logRejection("aucun jeton Bearer");
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(bearerToken, getJwks(), {
      issuer: supabaseAuthIssuer(),
      audience: "authenticated",
    });

    // Seuls les jetons OAuth portent client_id : une session web classique ne doit pas ouvrir le MCP.
    const clientId = typeof payload.client_id === "string" ? payload.client_id : undefined;
    if (!payload.sub || !clientId) {
      logRejection("jeton sans sub ou sans client_id", bearerToken);
      return undefined;
    }

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
  } catch (error) {
    const reason =
      error instanceof errors.JOSEError ? `${error.code}: ${error.message}` : String(error);
    logRejection(reason, bearerToken);
    return undefined;
  }
}
