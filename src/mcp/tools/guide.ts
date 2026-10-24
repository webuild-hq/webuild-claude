import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { readBuildGuide } from "../build-guide";

export function registerGuideTools(server: McpServer) {
  server.registerTool(
    "get_build_guide",
    {
      title: "Méthode Webuild",
      description:
        "Méthode complète pour construire une boutique Shopify avec Webuild : règles, déroulé étape par étape " +
        "(agence, brief, thème, installation en brouillon, sections, images, aperçu, publication) et résolution des " +
        "problèmes. Gratuit. À appeler une fois au début de toute création ou refonte de boutique.",
      annotations: { readOnlyHint: true },
    },
    async () => ({ content: [{ type: "text" as const, text: await readBuildGuide() }] }),
  );

  server.registerPrompt(
    "construire-boutique",
    {
      title: "Construire une boutique avec Webuild",
      description: "Lance la création d'une boutique Shopify avec un thème Webuild, en suivant la méthode complète.",
      argsSchema: z.object({
        brief: z.string().optional().describe("Marque, produits, ambiance, pages attendues (facultatif)."),
      }),
    },
    async ({ brief }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `${await readBuildGuide()}\n\n---\n\n` +
              "Aide-moi à construire une boutique Shopify avec Webuild en suivant cette méthode." +
              (brief?.trim() ? `\n\nBrief : ${brief.trim()}` : " Commence par me poser les questions du brief."),
          },
        },
      ],
    }),
  );
}
