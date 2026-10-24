import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyOrganization } from "@/modules/organizations/queries";

/** Agence de la page courante et utilisateur connecté (une seule lecture par requête). */
export const loadOrganization = cache(async (slug: string, path = "") => {
  const { supabase, user } = await requireUser(`/dashboard/${slug}${path}`);
  const organization = await getMyOrganization(supabase, user.id, slug);
  if (!organization) notFound();
  return { supabase, user, organization };
});
