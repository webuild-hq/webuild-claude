"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { OrgRole } from "./types";

export type ActionState = { error?: string; ok?: string };

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Tu n'as pas les droits pour faire ça.",
  invalid_role: "Ce rôle ne peut pas être attribué par invitation.",
  already_member: "Cette personne est déjà membre de l'agence.",
  last_owner: "L'agence doit garder au moins un propriétaire.",
  not_member: "Cette personne n'est pas membre de l'agence.",
  invitation_invalid: "Cette invitation n'est plus valide.",
  email_mismatch: "Cette invitation a été envoyée à une autre adresse email.",
};

function errorMessage(error: { message?: string } | null) {
  const code = error?.message ?? "";
  return ERROR_MESSAGES[code] ?? "Une erreur est survenue. Réessaie.";
}

export async function createOrganization(_state: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Donne un nom à l'agence." };
  if (name.length > 80) return { error: "Le nom est trop long (80 caractères maximum)." };

  const { supabase } = await requireUser("/dashboard/new");
  const { data, error } = await supabase.rpc("create_organization", { org_name: name });
  if (error || !data) return { error: errorMessage(error) };
  redirect(`/dashboard/${data.slug}`);
}

/** Change d'agence depuis le sélecteur et la mémorise pour la prochaine connexion. */
export async function switchOrganization(formData: FormData) {
  const organizationId = String(formData.get("organization_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase, user } = await requireUser("/dashboard");

  // RLS refuse une agence dont l'utilisateur n'est pas membre.
  await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, last_organization_id: organizationId, updated_at: new Date().toISOString() });
  redirect(`/dashboard/${slug}`);
}

export async function inviteMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = (formData.get("role") === "admin" ? "admin" : "member") satisfies OrgRole;
  if (!email.includes("@")) return { error: "Adresse email invalide." };

  const { supabase } = await requireUser(`/dashboard/${slug}/members`);
  const { error } = await supabase.rpc("create_invitation", {
    org: organizationId,
    invite_email: email,
    invite_role: role,
  });
  if (error) return { error: errorMessage(error) };

  refresh();
  return { ok: `Invitation créée pour ${email}. Copie le lien ci-dessous et envoie-le.` };
}

export async function revokeInvitation(formData: FormData) {
  const invitationId = String(formData.get("invitation_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const { supabase } = await requireUser(`/dashboard/${slug}/members`);
  await supabase.from("invitations").delete().eq("id", invitationId);
  refresh();
}

export async function removeMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const memberId = String(formData.get("user_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const { supabase, user } = await requireUser(`/dashboard/${slug}/members`);
  const { error } = await supabase.rpc("remove_member", { org: organizationId, member: memberId });
  if (error) return { error: errorMessage(error) };

  // Quitter soi-même l'agence : retour au dashboard, qui choisit une autre agence.
  if (memberId === user.id) redirect("/dashboard");
  refresh();
  return {};
}

export async function acceptInvitation(_state: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const { supabase } = await requireUser(`/invitations/${token}`);
  const { data, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error || !data) return { error: errorMessage(error) };
  redirect(`/dashboard/${data.slug}`);
}
