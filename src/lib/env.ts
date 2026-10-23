function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

// Accès direct à process.env.NEXT_PUBLIC_* pour que Next.js puisse les injecter côté navigateur.
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

/** Issuer des jetons Supabase Auth, aussi utilisé comme serveur d'autorisation OAuth du MCP. */
export const supabaseAuthIssuer = () => `${supabaseUrl()}/auth/v1`;
