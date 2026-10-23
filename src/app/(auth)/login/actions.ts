"use server";

import { redirect } from "next/navigation";
import { publicOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export type AuthFormState = { error?: string; message?: string };

function loginUrl(next: string, params: Record<string, string>) {
  const search = new URLSearchParams({ next, ...params });
  return `/login?${search.toString()}`;
}

export async function signInWithPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next") as string | null);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }
  redirect(next);
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const next = safeNextPath(formData.get("next") as string | null);
  const supabase = await createClient();
  const origin = await publicOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  // Sans session, la confirmation par email est activée : l'utilisateur doit cliquer sur le lien reçu.
  if (!data.session) {
    return { message: "Compte créé. Confirme ton adresse email via le lien reçu, puis reviens ici." };
  }
  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next") as string | null);
  const supabase = await createClient();
  const origin = await publicOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect(loginUrl(next, { error: "google" }));
  }
  redirect(data.url);
}
