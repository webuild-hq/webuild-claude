import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_RESOURCE_METADATA_PATH } from "@/lib/mcp/metadata";
import { verifySupabaseAccessToken, type WebuildAuthExtra } from "@/lib/mcp/verify-token";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whoami",
      {
        title: "Qui suis-je",
        description:
          "Renvoie le compte Webuild connecté à ce connecteur. Outil de test de la connexion OAuth.",
        annotations: { readOnlyHint: true },
      },
      async (ctx) => {
        const auth = ctx.http?.authInfo;
        const extra = auth?.extra as WebuildAuthExtra | undefined;
        const result = {
          userId: extra?.userId,
          email: extra?.email,
          oauthClientId: auth?.clientId,
          scopes: auth?.scopes ?? [],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      },
    );
  },
  {
    serverInfo: { name: "webuild", version: "0.1.0" },
    instructions:
      "Webuild fournit un catalogue de thèmes Shopify premium. Pour l'instant, seul l'outil de test whoami est disponible.",
  },
);

const authHandler = withMcpAuth(handler, verifySupabaseAccessToken, {
  required: true,
  resourceMetadataPath: MCP_RESOURCE_METADATA_PATH,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
