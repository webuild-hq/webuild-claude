import type { McpServer } from "@modelcontextprotocol/server";
import { createTokenClient } from "@/lib/supabase/token-client";
import type { WebuildAuthExtra } from "@/lib/mcp/verify-token";
import { listMyOrganizations } from "@/modules/organizations/queries";
import { ROLE_LABELS } from "@/modules/organizations/types";

export function registerListMyAgencies(server: McpServer) {
  server.registerTool(
    "list_my_agencies",
    {
      title: "Mes agences",
      description:
        "Liste les agences Webuild de l'utilisateur, son rôle dans chacune et l'agence utilisée par défaut. " +
        "Si l'utilisateur a plusieurs agences et n'a pas précisé laquelle utiliser pour une nouvelle boutique, " +
        "demande-lui avant toute action payante.",
      annotations: { readOnlyHint: true },
    },
    async (ctx) => {
      const auth = ctx.http?.authInfo;
      const extra = auth?.extra as WebuildAuthExtra | undefined;
      if (!auth || !extra) {
        return { isError: true, content: [{ type: "text", text: "Non authentifié." }] };
      }

      const supabase = createTokenClient(auth.token);
      const [organizations, { data: connection }] = await Promise.all([
        listMyOrganizations(supabase, extra.userId),
        supabase
          .from("mcp_connections")
          .select("default_organization_id")
          .eq("user_id", extra.userId)
          .eq("oauth_client_id", auth.clientId)
          .maybeSingle(),
      ]);

      // Sans choix enregistré, une agence unique est l'agence par défaut.
      const defaultId =
        connection?.default_organization_id ?? (organizations.length === 1 ? organizations[0].id : null);

      const result = {
        user: { email: extra.email ?? null },
        defaultAgency: organizations.find((org) => org.id === defaultId)?.slug ?? null,
        agencies: organizations.map((org) => ({
          name: org.name,
          slug: org.slug,
          role: ROLE_LABELS[org.role],
          isDefault: org.id === defaultId,
        })),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );
}
