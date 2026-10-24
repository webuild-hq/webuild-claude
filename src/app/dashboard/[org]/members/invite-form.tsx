"use client";

import { useActionState } from "react";
import { inviteMember, type ActionState } from "@/modules/organizations/actions";
import { Button, Input, Notice, Select } from "@/components/ui";

export function InviteForm({ organizationId, slug }: { organizationId: string; slug: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(inviteMember, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap gap-2">
        <Input name="email" type="email" required placeholder="Email" className="min-w-56 flex-1" />
        <Select name="role" defaultValue="member" className="w-auto">
          <option value="member">Membre</option>
          <option value="admin">Admin</option>
        </Select>
        <Button type="submit" disabled={pending}>
          Inviter
        </Button>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
    </form>
  );
}
