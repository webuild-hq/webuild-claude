"use client";

import { useActionState } from "react";
import { inviteMember, type ActionState } from "@/modules/organizations/actions";

export function InviteForm({ organizationId, slug }: { organizationId: string; slug: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(inviteMember, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="min-w-56 flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
        <select
          name="role"
          defaultValue="member"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        >
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
        >
          Inviter
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  );
}
