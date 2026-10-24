export type OrgRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type MyOrganization = Organization & { role: OrgRole };

export type Member = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: OrgRole;
  joinedAt: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expiresAt: string;
};

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  member: "Membre",
};

export function canManageMembers(role: OrgRole) {
  return role === "owner" || role === "admin";
}
