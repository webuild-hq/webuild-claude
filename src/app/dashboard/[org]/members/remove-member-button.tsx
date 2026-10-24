"use client";

import { useActionState } from "react";
import { removeMember, type ActionState } from "@/modules/organizations/actions";

export function RemoveMemberButton({
  organizationId,
  slug,
  userId,
  label,
}: {
  organizationId: string;
  slug: string;
  userId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeMember, {});

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!confirm(label === "Quitter" ? "Quitter cette agence ?" : "Retirer ce membre ?")) {
          event.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="user_id" value={userId} />
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      <button type="submit" disabled={pending} className="text-sm text-red-600 hover:underline">
        {label}
      </button>
    </form>
  );
}
