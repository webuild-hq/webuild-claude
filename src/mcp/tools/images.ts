import type { McpServer } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getTheme, THEMES } from "@/modules/themes/catalog";
import { readThemeGuide } from "@/modules/themes/files";
import { ASPECT_RATIOS, type AspectRatio, isImageGenerationConfigured } from "@/modules/images/generate";
import { generateSectionImage } from "@/modules/images/service";
import { dbErrorResult, errorResult, mcpContext, NOT_AUTHENTICATED, resolveAgency, textResult } from "../context";

/** Format par défaut d'après la section et le réglage, si Claude n'en donne pas. */
function defaultAspectRatio(section: string, setting = "", label = ""): AspectRatio {
  const target = `${setting} ${label}`.toLowerCase();
  if (target.includes("mobile")) return "9:16";
  if (/(logo|avatar|icon|icone|badge)/.test(target)) return "1:1";
  if (/(hero|banner|banniere|background|fond|cover|slide|desktop)/.test(`${section} ${target}`.toLowerCase())) {
    return "16:9";
  }
  return "4:5";
}

export function registerImageTools(server: McpServer) {
  server.registerTool(
    "generate_section_image",
    {
      title: "Générer une image de section",
      description:
        "Génère une image premium adaptée à une section d'un thème Webuild (hero, bannière, éditorial, lifestyle) " +
        "et renvoie une URL publique temporaire. Importe-la ensuite dans la boutique avec fileCreate du connecteur " +
        "Shopify, puis référence-la dans le template avec \"shopify://shop_images/<filename>\". " +
        "Débite des crédits (remboursés si la génération échoue). Ne remplace pas les vraies photos de produits.",
      inputSchema: z.object({
        theme: z.string().describe("Slug du thème."),
        section: z.string().describe("Type de section, par exemple hero-banner."),
        setting: z.string().optional().describe("Identifiant du réglage image_picker visé, par exemple image."),
        brief: z
          .string()
          .min(10)
          .max(1000)
          .describe("Description précise de l'image : sujet, ambiance, couleurs, cadrage, univers de la marque."),
        aspect_ratio: z.enum(ASPECT_RATIOS).optional().describe("Format. Par défaut : déduit de l'emplacement."),
        shop_domain: z.string().optional().describe("Domaine myshopify.com de la boutique concernée."),
        agency: z.string().optional().describe("Slug de l'agence à débiter. Par défaut : l'agence par défaut."),
      }),
    },
    async ({ theme: slug, section, setting, brief, aspect_ratio, shop_domain, agency }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;
      if (!isImageGenerationConfigured()) {
        return errorResult("La génération d'images n'est pas encore activée sur ce serveur Webuild.");
      }

      const theme = getTheme(slug);
      if (!theme) return errorResult(`Thème inconnu : ${slug}. Thèmes disponibles : ${THEMES.map((t) => t.slug).join(", ")}.`);
      const guide = await readThemeGuide(theme.slug);
      const sectionGuide = guide.sections[section];
      if (!sectionGuide) {
        return errorResult(`Section inconnue : ${section}. Sections : ${Object.keys(guide.sections).join(", ")}.`);
      }
      const imageSetting = guide.imageSettings.find((s) => s.section === section && (!setting || s.setting === setting));

      const resolved = await resolveAgency(context, { agency, shopDomain: shop_domain });
      if ("error" in resolved) return errorResult(resolved.error);

      let shopId: string | null = null;
      if (shop_domain) {
        const { data } = await context.supabase
          .from("shops")
          .select("id")
          .eq("organization_id", resolved.organization.id)
          .eq("myshopify_domain", shop_domain.toLowerCase().trim())
          .maybeSingle();
        shopId = data?.id ?? null;
      }

      const aspectRatio = aspect_ratio ?? defaultAspectRatio(section, setting ?? imageSetting?.setting, imageSetting?.label);
      const result = await generateSectionImage(context.supabase, {
        organizationId: resolved.organization.id,
        userId: context.userId,
        shopId,
        themeSlug: theme.slug,
        themeName: theme.name,
        section,
        sectionName: sectionGuide.name,
        setting: setting ?? imageSetting?.setting,
        settingLabel: imageSetting?.label,
        brief,
        aspectRatio,
        requestId: randomUUID(),
      });

      if ("error" in result) {
        if (result.error?.message === "image_failed") {
          return errorResult(
            "La génération de l'image a échoué (crédits remboursés). Reformule la description ou réessaie.",
          );
        }
        return dbErrorResult(result.error);
      }

      return textResult({
        agency: resolved.organization.slug,
        url: result.image.url,
        filename: result.image.filename,
        aspectRatio,
        creditsCharged: result.charged,
        shopifyReference: `shopify://shop_images/${result.image.filename}`,
        nextSteps: [
          `fileCreate(files: { originalSource: "${result.image.url}", filename: "${result.image.filename}", contentType: IMAGE, alt: "<texte alternatif>" })`,
          "Attends que fileStatus soit READY (query node(id) { ... on MediaImage { fileStatus } }).",
          `Dans le template : "${setting ?? imageSetting?.setting ?? "image"}": "shopify://shop_images/${result.image.filename}".`,
        ],
      });
    },
  );
}
