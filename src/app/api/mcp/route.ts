import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_RESOURCE_METADATA_PATH } from "@/lib/mcp/metadata";
import { verifySupabaseAccessToken } from "@/lib/mcp/verify-token";
import { MCP_INSTRUCTIONS, registerWebuildTools } from "@/mcp/server";

// La génération d'une image peut prendre plusieurs dizaines de secondes.
export const maxDuration = 60;

const handler = createMcpHandler(registerWebuildTools, {
  serverInfo: { name: "webuild", version: "1.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

const authHandler = withMcpAuth(handler, verifySupabaseAccessToken, {
  required: true,
  resourceMetadataPath: MCP_RESOURCE_METADATA_PATH,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
