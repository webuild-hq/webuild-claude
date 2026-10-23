import { corsPreflightResponse, protectedResourceMetadataResponse } from "@/lib/mcp/metadata";

// Variante à la racine, pour les clients qui ne font pas l'insertion du chemin de la ressource.
export function GET(req: Request) {
  return protectedResourceMetadataResponse(req);
}

export function OPTIONS() {
  return corsPreflightResponse();
}
