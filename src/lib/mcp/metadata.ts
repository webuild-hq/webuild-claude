import { generateProtectedResourceMetadata, getPublicOrigin } from "mcp-handler";
import { supabaseAuthIssuer } from "@/lib/env";

export const MCP_PATH = "/api/mcp";

/** Chemin des métadonnées RFC 9728 pour la ressource /api/mcp (insertion du chemin après .well-known). */
export const MCP_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

/** Protected Resource Metadata : indique à Claude que Supabase Auth est le serveur d'autorisation du MCP. */
export function protectedResourceMetadataResponse(req: Request) {
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [supabaseAuthIssuer()],
    resourceUrl: `${getPublicOrigin(req)}${MCP_PATH}`,
    additionalMetadata: { resource_name: "Webuild" },
  });
  return Response.json(metadata, {
    headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" },
  });
}

export function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/**
 * Copie des métadonnées du serveur d'autorisation Supabase, servie sur notre domaine
 * pour les clients MCP plus anciens qui la cherchent à la racine du serveur MCP.
 */
export async function authorizationServerMetadataResponse() {
  const url = new URL(supabaseAuthIssuer());
  const upstream = await fetch(
    `${url.origin}/.well-known/oauth-authorization-server${url.pathname}`,
  ).catch(() => null);
  if (!upstream?.ok) {
    return Response.json({ error: "authorization_server_unavailable" }, { status: 502 });
  }
  return Response.json(await upstream.json(), {
    headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" },
  });
}
