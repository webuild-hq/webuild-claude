import { buildThemeZip } from "@/modules/themes/package";
import { verifyDownloadToken } from "@/modules/themes/download-token";

/**
 * Téléchargement d'un thème livré, appelé par Shopify (themeCreate) ou par l'agence.
 * Le zip est construit à la volée à partir des sources et du verrou de licence de la livraison.
 *
 * Le jeton est dans `?token=` et non dans le chemin : themeCreate refuse ("Src is empty") une URL
 * dont le chemin contient le jeton, alors qu'il accepte un chemin court en .zip suivi d'un long paramètre.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const claims = verifyDownloadToken(token);
  if (!claims) {
    return new Response("Lien de téléchargement invalide ou expiré.", { status: 403 });
  }

  const zip = await buildThemeZip(claims.theme, {
    salt: claims.salt,
    hash: claims.hash,
    appOrigin: claims.appOrigin,
  });

  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${claims.theme}-${claims.shop.split(".")[0]}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
