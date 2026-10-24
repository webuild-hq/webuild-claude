import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLastOrganizationId, listMyOrganizations } from "@/modules/organizations/queries";

export const metadata = { title: "Dashboard | Webuild" };

/** Ouvre la dernière agence utilisée, sinon la première, sinon la création d'agence. */
export default function DashboardIndex() {
  return (
    <Suspense fallback={<p className="p-8 opacity-60">Chargement...</p>}>
      <RedirectToOrganization />
    </Suspense>
  );
}

async function RedirectToOrganization() {
  const { supabase, user } = await requireUser("/dashboard");
  const [organizations, lastId] = await Promise.all([
    listMyOrganizations(supabase, user.id),
    getLastOrganizationId(supabase, user.id),
  ]);

  const target = organizations.find((org) => org.id === lastId) ?? organizations[0];
  redirect(target ? `/dashboard/${target.slug}` : "/dashboard/new");
  return null;
}
