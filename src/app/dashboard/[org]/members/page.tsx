import { publicOrigin } from "@/lib/origin";
import { listMembers, listPendingInvitations } from "@/modules/organizations/queries";
import { canManageMembers, ROLE_LABELS } from "@/modules/organizations/types";
import { revokeInvitation } from "@/modules/organizations/actions";
import { getOrganizationPlan } from "@/modules/billing/queries";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadOrganization } from "../context";
import { InviteForm } from "./invite-form";
import { RemoveMemberButton } from "./remove-member-button";

export const metadata = { title: "Membres | Webuild" };

export default async function MembersPage({ params }: PageProps<"/dashboard/[org]/members">) {
  const { org: slug } = await params;
  const { supabase, user, organization } = await loadOrganization(slug, "/members");

  const manager = canManageMembers(organization.role);
  const [members, invitations, plan, origin] = await Promise.all([
    listMembers(supabase, organization.id),
    manager ? listPendingInvitations(supabase, organization.id) : Promise.resolve([]),
    getOrganizationPlan(supabase, organization.id),
    publicOrigin(),
  ]);
  const seatsUsed = members.length + invitations.length;

  return (
    <>
      <PageHeader
        title="Membres"
        description={`${seatsUsed} / ${plan.maxMembers} places utilisées (plan ${plan.name}, invitations en attente comprises).`}
      />

      <Card className="divide-y divide-border">
        {members.map((member) => {
          const isMe = member.userId === user.id;
          const canRemove = isMe || (manager && (member.role !== "owner" || organization.role === "owner"));
          return (
            <div key={member.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {member.fullName ?? member.email}
                  {isMe && <span className="text-muted"> (toi)</span>}
                </span>
                <span className="truncate text-sm text-muted">{member.email}</span>
              </div>
              <Badge>{ROLE_LABELS[member.role]}</Badge>
              {canRemove && (
                <RemoveMemberButton
                  organizationId={organization.id}
                  slug={slug}
                  userId={member.userId}
                  label={isMe ? "Quitter" : "Retirer"}
                />
              )}
            </div>
          );
        })}
      </Card>

      {manager && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">Inviter un membre</h2>
          <InviteForm organizationId={organization.id} slug={slug} />

          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted">Invitations en attente</h3>
              <p className="text-xs text-muted">
                Copie le lien et envoie-le à la personne invitée. Elle devra se connecter avec cette adresse email.
              </p>
              {invitations.map((invitation) => (
                <Card key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1 truncate">
                    {invitation.email} · {ROLE_LABELS[invitation.role]}
                  </span>
                  <CopyButton value={`${origin}/invitations/${invitation.token}`} />
                  <form action={revokeInvitation}>
                    <input type="hidden" name="invitation_id" value={invitation.id} />
                    <input type="hidden" name="slug" value={slug} />
                    <button type="submit" className="text-sm text-error hover:underline">
                      Annuler
                    </button>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
