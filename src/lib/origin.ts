import "server-only";
import { headers } from "next/headers";

/**
 * Origine publique du site (https://domaine).
 * En production sur Vercel, toujours le domaine de production (webuild-claude.vercel.app), même si la page est
 * ouverte depuis l'URL propre à un déploiement : l'URL du MCP, les liens d'invitation et les redirections d'email
 * doivent pointer vers le domaine stable. Sinon, reconstruite depuis les en-têtes du proxy ou de l'hébergeur.
 */
export async function publicOrigin(): Promise<string> {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && productionHost) {
    return `https://${productionHost}`;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Impossible de déterminer l'origine de la requête");
  }
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
