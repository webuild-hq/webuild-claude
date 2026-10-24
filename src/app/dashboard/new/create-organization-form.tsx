"use client";

import { useActionState } from "react";
import { createOrganization, type ActionState } from "@/modules/organizations/actions";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createOrganization, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="name"
        required
        maxLength={80}
        placeholder="Nom de l'agence"
        className="rounded-lg border border-border bg-surface px-3 py-2.5"
      />
      {state.error && <p className="text-sm text-error">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-foreground disabled:opacity-50"
      >
        Créer l&apos;agence
      </button>
    </form>
  );
}
