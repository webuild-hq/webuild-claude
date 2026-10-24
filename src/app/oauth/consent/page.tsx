import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listMyOrganizations } from "@/modules/organizations/queries";
import { decide } from "./actions";

export const metadata = { title: "Autoriser l'accès | Webuild" };

/**
 * Écran de consentement OAuth. Supabase Auth y redirige l'utilisateur avec un authorization_id
 * quand Claude demande l'accès au MCP Webuild (Site URL + Authorization Path dans Supabase).
 */
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Suspense fallback={<p className="opacity-60">Chargement...</p>}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Consent({
  searchParams,
}: {
  searchParams: PageProps<"/oauth/consent">["searchParams"];
}) {
  const params = await searchParams;
  const authorizationId =
    typeof params.authorization_id === "string" ? params.authorization_id : null;

  if (!authorizationId) {
    return <ErrorMessage>Demande d&apos;autorisation invalide : identifiant manquant.</ErrorMessage>;
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return <ErrorMessage>Cette demande d&apos;autorisation a expiré ou n&apos;est pas valide.</ErrorMessage>;
  }

  // L'utilisateur a déjà donné son accord pour ce client : Supabase renvoie directement l'URL de retour.
  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  const scopes = details.scope?.trim() ? details.scope.trim().split(/\s+/) : [];
  const userId = claims.claims.sub;
  const [organizations, { data: connection }, { data: preferences }] = await Promise.all([
    listMyOrganizations(supabase, userId),
    supabase
      .from("mcp_connections")
      .select("default_organization_id")
      .eq("user_id", userId)
      .eq("oauth_client_id", details.client.id)
      .maybeSingle(),
    supabase.from("user_preferences").select("last_organization_id").eq("user_id", userId).maybeSingle(),
  ]);
  const preselected =
    connection?.default_organization_id ?? preferences?.last_organization_id ?? organizations[0]?.id;

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-black/10 p-8 dark:border-white/15">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">
          {details.client.name || "Une application"} souhaite accéder à ton compte Webuild
        </h1>
        <p className="text-sm opacity-70">Connecté en tant que {details.user.email}</p>
      </div>

      <p className="text-sm">
        En autorisant l&apos;accès, cette application pourra utiliser les thèmes et les outils Webuild
        en ton nom, et consommer les crédits de ton agence.
      </p>

      {scopes.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Permissions demandées :</p>
          <ul className="mt-1 list-disc pl-5 opacity-80">
            {scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs opacity-60">Redirection après autorisation : {details.redirect_uri}</p>

      {params.error && (
        <p className="text-sm text-red-600">La décision n&apos;a pas pu être enregistrée. Réessaie.</p>
      )}

      <form action={decide} className="flex flex-col gap-5">
        <input type="hidden" name="authorization_id" value={authorizationId} />

        {organizations.length > 1 ? (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">Agence utilisée par défaut</legend>
            {organizations.map((org) => (
              <label key={org.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="organization_id"
                  value={org.id}
                  defaultChecked={org.id === preselected}
                  required
                />
                {org.name}
              </label>
            ))}
            <p className="text-xs opacity-60">
              Tu pourras préciser une autre agence à Claude dans une conversation.
            </p>
          </fieldset>
        ) : (
          organizations[0] && (
            <>
              <input type="hidden" name="organization_id" value={organizations[0].id} />
              <p className="text-sm opacity-80">
                Agence : <strong>{organizations[0].name}</strong>
              </p>
            </>
          )
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            name="decision"
            value="deny"
            formNoValidate
            className="flex-1 rounded-lg border border-black/15 px-4 py-2.5 font-medium dark:border-white/20"
          >
            Refuser
          </button>
          <button
            type="submit"
            name="decision"
            value="approve"
            className="flex-1 rounded-lg bg-foreground px-4 py-2.5 font-medium text-background"
          >
            Autoriser
          </button>
        </div>
      </form>
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <p className="max-w-md text-center text-red-600">{children}</p>;
}
