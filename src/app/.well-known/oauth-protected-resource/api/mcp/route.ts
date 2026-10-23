import { corsPreflightResponse, protectedResourceMetadataResponse } from "@/lib/mcp/metadata";

export function GET(req: Request) {
  return protectedResourceMetadataResponse(req);
}

export function OPTIONS() {
  return corsPreflightResponse();
}
