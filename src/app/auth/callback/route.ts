import { NextResponse, type NextRequest } from "next/server";
import { getPublicOrigin } from "mcp-handler";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/** Retour de Google ou du lien de confirmation email : échange le code contre une session. */
export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const search = new URLSearchParams({ next, error: "google" });
  return NextResponse.redirect(`${origin}/login?${search.toString()}`);
}
