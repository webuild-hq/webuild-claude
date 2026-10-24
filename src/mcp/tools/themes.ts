import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getTheme, THEMES } from "@/modules/themes/catalog";
import { readThemeGuide } from "@/modules/themes/files";
import { prepareThemeInstall } from "@/modules/deliveries/service";
import { dbErrorResult, errorResult, mcpContext, NOT_AUTHENTICATED, resolveAgency, textResult } from "../context";

const INSTALL_STEPS = (themeName: string, url: string) => [
  `1. Avec le connecteur Shopify, appelle la mutation themeCreate(source: "${url}", name: "${themeName} (Webuild)", role: UNPUBLISHED). ` +
    "Ne publie jamais directement : le thème reste en brouillon tant que l'utilisateur n'a pas validé.",
  "2. Shopify importe le zip en arrière-plan : interroge theme(id) { processing processingFailed } jusqu'à processing = false.",
  "3. Personnalise le thème avec themeFilesUpsert : templates/*.json (sections, réglages, blocs) et config/settings_data.json. " +
    "Utilise get_theme_guide pour connaître les sections et réglages disponibles.",
  "4. Pour chaque image : generate_section_image, puis fileCreate(files: { originalSource: <url>, filename: <filename>, contentType: IMAGE }) " +
    "et attends fileStatus = READY. Dans le template, la valeur du réglage image est \"shopify://shop_images/<filename>\".",
  "5. Donne à l'utilisateur le lien d'aperçu https://<domaine>/?preview_theme_id=<id du thème> et attends sa validation.",
  "6. Après validation explicite seulement : themePublish(id).",
  "Le lien de téléchargement expire au bout d'une heure ; si themeCreate échoue pour cette raison, rappelle prepare_theme_install (gratuit pour la même boutique).",
];

export function registerThemeTools(server: McpServer) {
  server.registerTool(
    "list_themes",
    {
      title: "Catalogue de thèmes",
      description:
        "Liste les thèmes Shopify premium Webuild : style, cas d'usage, points forts. " +
        "Aide l'utilisateur à choisir le thème adapté à sa boutique.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      textResult({
        themes: THEMES.map((theme) => ({
          slug: theme.slug,
          name: theme.name,
          version: theme.version,
          tagline: theme.tagline,
          description: theme.description,
          bestFor: theme.bestFor,
          highlights: theme.highlights,
        })),
      }),
  );

  server.registerTool(
    "get_theme_guide",
    {
      title: "Guide d'un thème",
      description:
        "Structure d'un thème : templates (sections par page), sections disponibles et emplacements d'image. " +
        "Sans `section`, renvoie la vue d'ensemble ; avec `section`, renvoie tous les réglages et blocs de cette section " +
        "(identifiants, types, valeurs par défaut, options). À utiliser avant de modifier les templates avec themeFilesUpsert.",
      inputSchema: z.object({
        theme: z.string().describe("Slug du thème, par exemple skeleton."),
        section: z.string().optional().describe("Type de section, par exemple hero-banner."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ theme: slug, section }) => {
      const theme = getTheme(slug);
      if (!theme) return errorResult(`Thème inconnu : ${slug}. Thèmes disponibles : ${THEMES.map((t) => t.slug).join(", ")}.`);
      const guide = await readThemeGuide(theme.slug);

      if (section) {
        const detail = guide.sections[section];
        if (!detail) {
          return errorResult(`Section inconnue : ${section}. Sections : ${Object.keys(guide.sections).join(", ")}.`);
        }
        return textResult({ theme: theme.slug, section, ...detail });
      }

      return textResult({
        theme: theme.slug,
        name: theme.name,
        templates: guide.templates,
        sections: Object.fromEntries(
          Object.entries(guide.sections).map(([type, s]) => [
            type,
            {
              name: s.name,
              settings: s.settings?.length ?? 0,
              blocks: s.blocks?.map((b) => b.type) ?? [],
            },
          ]),
        ),
        imageSettings: guide.imageSettings,
        note: "Appelle get_theme_guide avec `section` pour obtenir le détail des réglages d'une section.",
      });
    },
  );

  server.registerTool(
    "prepare_theme_install",
    {
      title: "Préparer l'installation d'un thème",
      description:
        "Livre un thème Webuild pour une boutique Shopify : enregistre la licence (liée au domaine myshopify.com) " +
        "et renvoie un lien de téléchargement temporaire du zip, à passer à themeCreate. " +
        "Débite des crédits la première fois ; gratuit pour la même boutique et la même version ensuite. " +
        "Le domaine doit être le domaine permanent (shop { myshopifyDomain } dans l'API Shopify).",
      inputSchema: z.object({
        theme: z.string().describe("Slug du thème."),
        shop_domain: z.string().describe("Domaine permanent de la boutique, au format xxx.myshopify.com."),
        agency: z.string().optional().describe("Slug de l'agence à débiter. Par défaut : l'agence par défaut."),
      }),
    },
    async ({ theme: slug, shop_domain, agency }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;

      const theme = getTheme(slug);
      if (!theme) return errorResult(`Thème inconnu : ${slug}. Thèmes disponibles : ${THEMES.map((t) => t.slug).join(", ")}.`);

      const resolved = await resolveAgency(context, { agency, shopDomain: shop_domain });
      if ("error" in resolved) return errorResult(resolved.error);

      const result = await prepareThemeInstall(context.supabase, {
        organizationId: resolved.organization.id,
        shopDomain: shop_domain,
        themeSlug: theme.slug,
        appOrigin: context.appOrigin,
      });
      if ("error" in result) return dbErrorResult(result.error);

      return textResult({
        agency: resolved.organization.slug,
        shop: result.delivery.myshopify_domain,
        theme: { slug: theme.slug, name: theme.name, version: theme.version },
        creditsCharged: result.delivery.credits_charged,
        alreadyDelivered: result.delivery.reused,
        downloadUrl: result.download.url,
        downloadExpiresAt: result.download.expiresAt,
        nextSteps: INSTALL_STEPS(theme.name, result.download.url),
      });
    },
  );
}
