import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicOrigin } from "@/lib/origin";
import { MCP_PATH } from "@/lib/mcp/metadata";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Webuild pour Claude</h1>
        <p className="opacity-70">
          Thèmes Shopify premium, installés et personnalisés par Claude sur les boutiques de tes
          clients.
        </p>
      </div>
      <Suspense fallback={<p className="opacity-60">Chargement...</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const mcpUrl = `${await publicOrigin()}${MCP_PATH}`;

  if (!data) {
    return (
      <Link
        href="/login"
        className="self-start rounded-lg bg-foreground px-4 py-2.5 font-medium text-background"
      >
        Se connecter
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 p-6 dark:border-white/15">
      <p>
        Connecté en tant que <strong>{String(data.claims.email ?? data.claims.sub)}</strong>
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Connecter Webuild à Claude</p>
        <p className="opacity-70">
          Dans Claude : Paramètres, Connecteurs, Ajouter un connecteur personnalisé, puis colle
          cette URL :
        </p>
        <code className="break-all rounded-lg bg-black/5 px-3 py-2 dark:bg-white/10">{mcpUrl}</code>
      </div>
    </div>
  );
}
