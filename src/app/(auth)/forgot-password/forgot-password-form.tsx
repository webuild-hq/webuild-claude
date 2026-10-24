"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthFormState } from "../login/actions";
import { Button, Input, Notice } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <Input name="email" type="email" required autoComplete="email" placeholder="Email" />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Button type="submit" disabled={pending}>
        Envoyer le lien
      </Button>
      <Link href="/login" className="text-center text-sm text-muted underline hover:text-foreground">
        Retour à la connexion
      </Link>
    </form>
  );
}
