"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export type AuthFormState = {
  error?: string;
  message?: string;
  /** Email à qui proposer de renvoyer le lien de confirmation. */
  unconfirmedEmail?: string;
};

function loginUrl(next: string, params: Record<string, string>) {
  const search = new URLSearchParams({ next, ...params });
  return `/login?${search.toString()}`;
}

/** Messages selon le code d'erreur Supabase Auth, au lieu d'un "mot de passe incorrect" trompeur. */
function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Ton adresse email n'est pas encore confirmée. Clique sur le lien reçu par email.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cet email. Connecte-toi, ou utilise \"Mot de passe oublié\".";
    case "weak_password":
      return "Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.";
    case "email_address_invalid":
      return "Adresse email invalide.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
    case "signup_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    default:
      return "La connexion a échoué. Réessaie dans un instant.";
  }
}

function emailRedirect(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signInWithPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next") as string | null, "/dashboard");
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    return {
      error: authErrorMessage(error),
      unconfirmedEmail: error.code === "email_not_confirmed" ? email : undefined,
    };
  }
  redirect(next);
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next") as string | null, "/dashboard");
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  const origin = await publicOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password") ?? ""),
    options: { emailRedirectTo: emailRedirect(origin, next) },
  });

  if (error) {
    return { error: authErrorMessage(error) };
  }
  // Supabase ne signale pas un email déjà inscrit (protection contre l'énumération) : identities est vide.
  if (data.user && data.user.identities?.length === 0) {
    return { error: authErrorMessage({ code: "user_already_exists" } as AuthError) };
  }
  // Sans session, la confirmation par email est activée : l'utilisateur doit cliquer sur le lien reçu.
  if (!data.session) {
    return {
      message: "Compte créé. Confirme ton adresse email via le lien reçu, puis reviens ici.",
      unconfirmedEmail: email,
    };
  }
  redirect(next);
}

export async function resendConfirmation(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(formData.get("next") as string | null, "/dashboard");
  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirect(await publicOrigin(), next) },
  });
  if (error) return { error: authErrorMessage(error), unconfirmedEmail: email };
  return { message: `Email de confirmation renvoyé à ${email}.` };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string | null, "/dashboard");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: emailRedirect(await publicOrigin(), next) },
  });

  if (error || !data.url) {
    redirect(loginUrl(next, { error: "google" }));
  }
  redirect(data.url);
}

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Adresse email invalide." };
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirect(await publicOrigin(), "/reset-password"),
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: authErrorMessage(error) };
  }
  // Même réponse que le compte existe ou non, pour ne pas révéler les emails inscrits.
  return { message: `Si un compte existe pour ${email}, un lien de réinitialisation vient d'être envoyé.` };
}

export async function updatePassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "8 caractères minimum." };
  if (password !== confirmation) return { error: "Les deux mots de passe ne correspondent pas." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return { error: "Lien expiré. Redemande un lien de réinitialisation." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Le nouveau mot de passe doit être différent de l'ancien."
          : authErrorMessage(error),
    };
  }
  redirect("/dashboard?password=updated");
}
