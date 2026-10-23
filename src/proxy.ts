import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Exclut les fichiers statiques, le MCP (authentifié par jeton Bearer) et les métadonnées OAuth.
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
