import { buildThemeZip } from "@/modules/themes/package";
import { verifyDownloadToken } from "@/modules/themes/download-token";

/**
 * Téléchargement d'un thème livré, appelé par Shopify (themeCreate) ou par l'agence.
 * Le zip est construit à la volée à partir des sources et du verrou de licence de la livraison.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/themes/download/[token]/[file]">) {
  const { token } = await ctx.params;
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
