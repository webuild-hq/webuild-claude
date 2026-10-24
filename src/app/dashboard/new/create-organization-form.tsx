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
        className="rounded-lg border border-black/15 bg-transparent px-3 py-2.5 dark:border-white/20"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-foreground px-4 py-2.5 font-medium text-background disabled:opacity-60"
      >
        Créer l&apos;agence
      </button>
    </form>
  );
}
