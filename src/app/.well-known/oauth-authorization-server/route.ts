import { connection } from "next/server";
import { authorizationServerMetadataResponse, corsPreflightResponse } from "@/lib/mcp/metadata";

export async function GET() {
  // Toujours à la demande : pas de prérendu au build.
  await connection();
  return authorizationServerMetadataResponse();
}

export function OPTIONS() {
  return corsPreflightResponse();
}
