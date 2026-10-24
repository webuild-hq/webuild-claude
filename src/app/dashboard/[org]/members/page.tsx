import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/origin";
import {
  getMyOrganization,
  listMembers,
  listPendingInvitations,
} from "@/modules/organizations/queries";
import { canManageMembers, ROLE_LABELS } from "@/modules/organizations/types";
import { revokeInvitation } from "@/modules/organizations/actions";
import { InviteForm } from "./invite-form";
import { RemoveMemberButton } from "./remove-member-button";
import { CopyButton } from "./copy-button";

export const metadata = { title: "Membres | Webuild" };

export default function MembersPage({ params }: PageProps<"/dashboard/[org]/members">) {
  return (
    <Suspense fallback={<p className="opacity-60">Chargement...</p>}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: { params: PageProps<"/dashboard/[org]/members">["params"] }) {
  const { org: slug } = await params;
  const { supabase, user } = await requireUser(`/dashboard/${slug}/members`);
  const organization = await getMyOrganization(supabase, user.id, slug);
  if (!organization) notFound();

  const manager = canManageMembers(organization.role);
  const [members, invitations, origin] = await Promise.all([
    listMembers(supabase, organization.id),
    manager ? listPendingInvitations(supabase, organization.id) : Promise.resolve([]),
    publicOrigin(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Membres</h1>

      <section className="flex flex-col divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15">
        {members.map((member) => {
          const isMe = member.userId === user.id;
          const canRemove =
            isMe || (manager && (member.role !== "owner" || organization.role === "owner"));
          return (
            <div key={member.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {member.fullName ?? member.email}
                  {isMe && <span className="opacity-60"> (toi)</span>}
                </span>
                <span className="truncate text-sm opacity-60">{member.email}</span>
              </div>
              <span className="text-sm opacity-80">{ROLE_LABELS[member.role]}</span>
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
      </section>

      {manager && (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Inviter un membre</h2>
          <InviteForm organizationId={organization.id} slug={slug} />

          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium opacity-80">Invitations en attente</h3>
              {invitations.map((invitation) => {
                const link = `${origin}/invitations/${invitation.token}`;
                return (
                  <div
                    key={invitation.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/15"
                  >
                    <span className="flex-1 truncate">
                      {invitation.email} · {ROLE_LABELS[invitation.role]}
                    </span>
                    <CopyButton value={link} />
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitation_id" value={invitation.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <button type="submit" className="text-red-600 hover:underline">
                        Annuler
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
