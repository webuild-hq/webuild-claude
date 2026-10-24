"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "../login/actions";
import { Button, Input, Notice } from "@/components/ui";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Nouveau mot de passe" />
      <Input name="confirmation" type="password" required minLength={8} autoComplete="new-password" placeholder="Confirmation" />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}
