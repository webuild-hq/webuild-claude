"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  resendConfirmation,
  signInWithGoogle,
  signInWithPassword,
  signUp,
  type AuthFormState,
} from "./actions";
import { Button, Input, Notice } from "@/components/ui";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInWithPassword : signUp;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});
  const [resendState, resendAction, resending] = useActionState<AuthFormState, FormData>(resendConfirmation, {});

  const errorMessage =
    state.error ?? (error === "google" ? "La connexion avec Google a échoué." : undefined);
  const unconfirmedEmail = resendState.unconfirmedEmail ?? state.unconfirmedEmail;

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          Continuer avec Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <Input name="email" type="email" required autoComplete="email" placeholder="Email" />
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Mot de passe"
        />
        {errorMessage && <Notice tone="error">{errorMessage}</Notice>}
        {state.message && <Notice tone="success">{state.message}</Notice>}
        <Button type="submit" disabled={pending}>
          {mode === "signin" ? "Se connecter" : "Créer un compte"}
        </Button>
      </form>

      {unconfirmedEmail && (
        <form action={resendAction} className="flex flex-col gap-2">
          <input type="hidden" name="email" value={unconfirmedEmail} />
          <input type="hidden" name="next" value={next} />
          {resendState.message && <Notice tone="success">{resendState.message}</Notice>}
          {resendState.error && <Notice tone="error">{resendState.error}</Notice>}
          <Button type="submit" variant="secondary" disabled={resending}>
            Renvoyer l&apos;email de confirmation
          </Button>
        </form>
      )}

      <div className="flex flex-col items-center gap-2 text-sm">
        {mode === "signin" && (
          <Link href="/forgot-password" className="text-muted underline hover:text-foreground">
            Mot de passe oublié ?
          </Link>
        )}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-muted underline hover:text-foreground"
        >
          {mode === "signin" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
        </button>
      </div>
    </div>
  );
}
