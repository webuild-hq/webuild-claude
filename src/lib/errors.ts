/** Codes d'erreur levés par les fonctions SQL (raise exception '<code>'), traduits pour l'utilisateur. */
const MESSAGES: Record<string, string> = {
  forbidden: "Tu n'as pas les droits pour faire ça.",
  invalid_role: "Ce rôle ne peut pas être attribué par invitation.",
  already_member: "Cette personne est déjà membre de l'agence.",
  last_owner: "L'agence doit garder au moins un propriétaire.",
  not_member: "Cette personne n'est pas membre de l'agence.",
  invitation_invalid: "Cette invitation n'est plus valide.",
  email_mismatch: "Cette invitation a été envoyée à une autre adresse email.",
  seat_limit: "Le nombre de places de ton plan est atteint. Passe à un plan supérieur pour inviter plus de membres.",
  insufficient_credits: "Crédits insuffisants pour cette action. Recharge en changeant de plan.",
  invalid_shop_domain: "Le domaine doit être le domaine permanent de la boutique, au format xxx.myshopify.com.",
  unknown_action: "Action inconnue.",
  download_not_configured:
    "L'installation de thèmes est momentanément indisponible côté Webuild. Aucun crédit n'a été débité. Réessaie plus tard.",
};

export type DbError = { message?: string; details?: string | null } | null | undefined;

export function errorCode(error: DbError): string {
  return error?.message ?? "";
}

export function errorMessage(error: DbError, fallback = "Une erreur est survenue. Réessaie."): string {
  return MESSAGES[errorCode(error)] ?? fallback;
}

/** Détail "balance=120 price=200" de insufficient_credits. */
export function parseCreditDetail(error: DbError): { balance?: number; price?: number } {
  const match = error?.details?.match(/balance=(-?\d+) price=(\d+)/);
  return match ? { balance: Number(match[1]), price: Number(match[2]) } : {};
}
