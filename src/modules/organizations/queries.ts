import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, MyOrganization, OrgRole, PendingInvitation } from "./types";

type MembershipRow = {
  role: OrgRole;
  organizations: { id: string; name: string; slug: string } | null;
};

/** Agences dont l'utilisateur est membre, triées par nom. */
export async function listMyOrganizations(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyOrganization[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations (id, name, slug)")
    .eq("user_id", userId)
    .returns<MembershipRow[]>();
  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.organizations)
    .map((row) => ({ ...row.organizations!, role: row.role }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getMyOrganization(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<MyOrganization | null> {
  const organizations = await listMyOrganizations(supabase, userId);
  return organizations.find((org) => org.slug === slug) ?? null;
}

export async function getLastOrganizationId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_preferences")
    .select("last_organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.last_organization_id ?? null;
}

type MemberRow = {
  user_id: string;
  role: OrgRole;
  created_at: string;
};

type ProfileRow = { id: string; email: string | null; full_name: string | null };

export async function listMembers(supabase: SupabaseClient, organizationId: string): Promise<Member[]> {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at")
    .returns<MemberRow[]>();
  if (error) throw error;

  const ids = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids).returns<ProfileRow[]>()
    : { data: [] as ProfileRow[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (memberships ?? []).map((m) => ({
    userId: m.user_id,
    email: byId.get(m.user_id)?.email ?? null,
    fullName: byId.get(m.user_id)?.full_name ?? null,
    role: m.role,
    joinedAt: m.created_at,
  }));
}

/** Invitations en attente (visibles uniquement par propriétaires et admins, via RLS). */
export async function listPendingInvitations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PendingInvitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, token, expires_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    expiresAt: i.expires_at,
  }));
}

export type InvitationPreview = {
  organizationName: string;
  email: string;
  role: OrgRole;
  status: "pending" | "accepted" | "expired";
};

export async function getInvitation(
  supabase: SupabaseClient,
  token: string,
): Promise<InvitationPreview | null> {
  const { data, error } = await supabase.rpc("get_invitation", { invite_token: token });
  if (error || !data?.length) return null;
  const row = data[0];
  return {
    organizationName: row.organization_name,
    email: row.email,
    role: row.role,
    status: row.status,
  };
}
