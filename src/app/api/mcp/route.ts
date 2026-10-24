import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_RESOURCE_METADATA_PATH } from "@/lib/mcp/metadata";
import { verifySupabaseAccessToken } from "@/lib/mcp/verify-token";
import { registerListMyAgencies } from "@/mcp/tools/list-my-agencies";

const handler = createMcpHandler(
  (server) => {
    registerListMyAgencies(server);
  },
  {
    serverInfo: { name: "webuild", version: "0.2.0" },
    instructions:
      "Webuild fournit un catalogue de thèmes Shopify premium pour les agences. " +
      "Commence par list_my_agencies pour savoir avec quelle agence travailler. " +
      "Si l'utilisateur a plusieurs agences, demande-lui laquelle utiliser avant toute action payante.",
  },
);

const authHandler = withMcpAuth(handler, verifySupabaseAccessToken, {
  required: true,
  resourceMetadataPath: MCP_RESOURCE_METADATA_PATH,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
