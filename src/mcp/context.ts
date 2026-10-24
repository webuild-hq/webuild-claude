import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerContext } from "@modelcontextprotocol/server";
import { getPublicOrigin } from "mcp-handler";
import { createTokenClient } from "@/lib/supabase/token-client";
import type { WebuildAuthExtra } from "@/lib/mcp/verify-token";
import { errorMessage, parseCreditDetail, type DbError } from "@/lib/errors";
import { listMyOrganizations } from "@/modules/organizations/queries";
import type { MyOrganization } from "@/modules/organizations/types";

export type McpContext = {
  supabase: SupabaseClient;
  userId: string;
  email?: string;
  clientId: string;
  appOrigin: string;
};

export function mcpContext(ctx: ServerContext): McpContext | null {
  const auth = ctx.http?.authInfo;
  const extra = auth?.extra as WebuildAuthExtra | undefined;
  if (!auth || !extra) return null;
  const req = ctx.http?.req;
  return {
    supabase: createTokenClient(auth.token),
    userId: extra.userId,
    email: extra.email,
    clientId: auth.clientId,
    appOrigin: req ? getPublicOrigin(req) : "",
  };
}

export async function defaultOrganizationId(context: McpContext, organizations: MyOrganization[]) {
  const { data } = await context.supabase
    .from("mcp_connections")
    .select("default_organization_id")
    .eq("user_id", context.userId)
    .eq("oauth_client_id", context.clientId)
    .maybeSingle();
  return data?.default_organization_id ?? (organizations.length === 1 ? organizations[0].id : null);
}

/**
 * Agence d'une action : celle demandée (slug), sinon celle qui possède déjà la boutique,
 * sinon l'agence par défaut choisie au consentement, sinon l'unique agence.
 */
export async function resolveAgency(
  context: McpContext,
  options: { agency?: string; shopDomain?: string },
): Promise<{ organization: MyOrganization } | { error: string }> {
  const organizations = await listMyOrganizations(context.supabase, context.userId);
  if (organizations.length === 0) {
    return { error: "Aucune agence pour ce compte." };
  }

  if (options.agency) {
    const wanted = options.agency.toLowerCase();
    const organization = organizations.find((org) => org.slug === wanted || org.name.toLowerCase() === wanted);
    return organization
      ? { organization }
      : { error: `Agence inconnue : ${options.agency}. Agences disponibles : ${organizations.map((o) => o.slug).join(", ")}.` };
  }

  if (options.shopDomain) {
    const { data: shops } = await context.supabase
      .from("shops")
      .select("organization_id")
      .eq("myshopify_domain", options.shopDomain.toLowerCase().trim());
    const owners = organizations.filter((org) => shops?.some((s) => s.organization_id === org.id));
    if (owners.length === 1) return { organization: owners[0] };
  }

  const defaultId = await defaultOrganizationId(context, organizations);
  const organization = organizations.find((org) => org.id === defaultId);
  if (organization) return { organization };

  return {
    error:
      "Plusieurs agences sont disponibles et aucune n'est définie par défaut. Demande à l'utilisateur laquelle " +
      `utiliser, puis repasse son slug dans le paramètre agency : ${organizations.map((o) => o.slug).join(", ")}.`,
  };
}

export function textResult(value: unknown) {
  const structured = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function dbErrorResult(error: DbError) {
  if (error?.message === "insufficient_credits") {
    const { balance, price } = parseCreditDetail(error);
    return errorResult(
      `Crédits insuffisants : solde ${balance ?? "?"} crédits, coût ${price ?? "?"} crédits. ` +
        "L'utilisateur peut changer de plan depuis son dashboard Webuild (page Abonnement).",
    );
  }
  return errorResult(errorMessage(error));
}

export const NOT_AUTHENTICATED = errorResult("Non authentifié.");
