import "server-only";
import { headers } from "next/headers";

/** Origine publique du site (https://domaine), reconstruite depuis les en-têtes du proxy ou de l'hébergeur. */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Impossible de déterminer l'origine de la requête");
  }
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}
