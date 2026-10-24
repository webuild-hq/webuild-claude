import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLastOrganizationId, listMyOrganizations } from "@/modules/organizations/queries";

export const metadata = { title: "Dashboard | Webuild" };

/** Ouvre la dernière agence utilisée, sinon la première, sinon la création d'agence. */
export default function DashboardIndex({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Chargement...</p>}>
      <RedirectToOrganization searchParams={searchParams} />
    </Suspense>
  );
}

async function RedirectToOrganization({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const { password } = await searchParams;
  const { supabase, user } = await requireUser("/dashboard");
  const [organizations, lastId] = await Promise.all([
    listMyOrganizations(supabase, user.id),
    getLastOrganizationId(supabase, user.id),
  ]);

  const target = organizations.find((org) => org.id === lastId) ?? organizations[0];
  const suffix = password === "updated" ? "?password=updated" : "";
  redirect(target ? `/dashboard/${target.slug}${suffix}` : "/dashboard/new");
  return null;
}
