"use client";

import { useActionState } from "react";
import { acceptInvitation, type ActionState } from "@/modules/organizations/actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(acceptInvitation, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-foreground disabled:opacity-50"
      >
        Accepter l&apos;invitation
      </button>
    </form>
  );
}
