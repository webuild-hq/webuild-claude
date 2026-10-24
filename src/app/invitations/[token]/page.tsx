import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getInvitation } from "@/modules/organizations/queries";
import { ROLE_LABELS } from "@/modules/organizations/types";
import { AcceptInvitationForm } from "./accept-invitation-form";

export const metadata = { title: "Invitation | Webuild" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function InvitationPage({ params }: PageProps<"/invitations/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Suspense fallback={<p className="opacity-60">Chargement...</p>}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

async function Invitation({ params }: { params: PageProps<"/invitations/[token]">["params"] }) {
  const { token } = await params;
  const { supabase, user } = await requireUser(`/invitations/${token}`);
  const invitation = UUID.test(token) ? await getInvitation(supabase, token) : null;

  if (!invitation) {
    return <Message>Cette invitation n&apos;existe pas.</Message>;
  }
  if (invitation.status === "accepted") {
    return <Message>Cette invitation a déjà été acceptée.</Message>;
  }
  if (invitation.status === "expired") {
    return <Message>Cette invitation a expiré. Demande à l&apos;agence de t&apos;en envoyer une nouvelle.</Message>;
  }

  const emailMatches = user.email?.toLowerCase() === invitation.email;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-black/10 p-8 dark:border-white/15">
      <h1 className="text-xl font-semibold">Rejoindre {invitation.organizationName}</h1>
      <p className="text-sm opacity-80">
        Tu es invité en tant que <strong>{ROLE_LABELS[invitation.role]}</strong>.
      </p>
      {emailMatches ? (
        <AcceptInvitationForm token={token} />
      ) : (
        <p className="text-sm text-red-600">
          Cette invitation a été envoyée à {invitation.email}, mais tu es connecté avec {user.email}.
          Connecte-toi avec la bonne adresse pour l&apos;accepter.
        </p>
      )}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="max-w-md text-center opacity-80">{children}</p>;
}
