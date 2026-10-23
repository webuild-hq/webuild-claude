"use client";

import { useActionState, useState } from "react";
import { signInWithGoogle, signInWithPassword, signUp, type AuthFormState } from "./actions";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInWithPassword : signUp;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});

  const errorMessage =
    state.error ?? (error === "google" ? "La connexion avec Google a échoué." : undefined);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full rounded-lg border border-black/15 px-4 py-2.5 font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Continuer avec Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-sm opacity-60">
        <span className="h-px flex-1 bg-current opacity-30" />
        ou
        <span className="h-px flex-1 bg-current opacity-30" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2.5 dark:border-white/20"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Mot de passe"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2.5 dark:border-white/20"
        />
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {state.message && <p className="text-sm text-green-700">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-foreground px-4 py-2.5 font-medium text-background disabled:opacity-60"
        >
          {mode === "signin" ? "Se connecter" : "Créer un compte"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm underline opacity-70"
      >
        {mode === "signin" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
      </button>
    </div>
  );
}
