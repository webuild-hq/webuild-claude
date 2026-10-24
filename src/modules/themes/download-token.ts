import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lien de téléchargement signé d'un thème livré. Tout ce qu'il faut pour construire le zip est
 * dans le jeton (signé HMAC) : Shopify peut le télécharger sans session ni accès à la base.
 */
export type DownloadClaims = {
  deliveryId: string;
  theme: string;
  shop: string;
  salt: string;
  hash: string;
  appOrigin: string;
  expiresAt: number;
};

/** Durée de validité : Shopify télécharge le zip de façon asynchrone après themeCreate. */
export const DOWNLOAD_TTL_SECONDS = 60 * 60;

function secret() {
  const value = process.env.THEME_DOWNLOAD_SECRET;
  if (!value || value.length < 32) {
    throw new Error("THEME_DOWNLOAD_SECRET manquant ou trop court (32 caractères minimum)");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createDownloadToken(claims: Omit<DownloadClaims, "expiresAt">, now = Date.now()) {
  const full: DownloadClaims = { ...claims, expiresAt: Math.floor(now / 1000) + DOWNLOAD_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: full.expiresAt };
}

export function verifyDownloadToken(token: string, now = Date.now()): DownloadClaims | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DownloadClaims;
    return claims.expiresAt > now / 1000 ? claims : null;
  } catch {
    return null;
  }
}
