import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import { MCP_PATH } from "@/lib/mcp/metadata";
import { getMyOrganization } from "@/modules/organizations/queries";
import { ROLE_LABELS } from "@/modules/organizations/types";

export default function OrganizationOverview({ params }: PageProps<"/dashboard/[org]">) {
  return (
    <Suspense fallback={<p className="opacity-60">Chargement...</p>}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: PageProps<"/dashboard/[org]">["params"] }) {
  const { org: slug } = await params;
  const { supabase, user } = await requireUser(`/dashboard/${slug}`);
  const organization = await getMyOrganization(supabase, user.id, slug);
  if (!organization) notFound();
  const mcpUrl = `${await publicOrigin()}${MCP_PATH}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <p className="text-sm opacity-70">Ton rôle : {ROLE_LABELS[organization.role]}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 dark:border-white/15">
        <h2 className="font-medium">Connecter Webuild à Claude</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm opacity-80">
          <li>Dans Claude : Paramètres, Connecteurs, Ajouter un connecteur personnalisé.</li>
          <li>Colle l&apos;URL ci-dessous, puis connecte-toi avec ton compte Webuild.</li>
          <li>Sur l&apos;écran d&apos;autorisation, choisis l&apos;agence à utiliser par défaut.</li>
        </ol>
        <code className="break-all rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/10">{mcpUrl}</code>
      </section>
    </>
  );
}
