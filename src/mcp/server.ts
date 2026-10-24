import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccountTools } from "./tools/account";
import { registerImageTools } from "./tools/images";
import { registerThemeTools } from "./tools/themes";

export const MCP_INSTRUCTIONS = [
  "Webuild fournit des thèmes Shopify premium et les outils pour construire une boutique complète avec le connecteur Shopify.",
  "Déroulé recommandé :",
  "1. list_my_agencies : si l'utilisateur a plusieurs agences et n'a rien précisé, demande laquelle utiliser.",
  "2. list_themes puis get_theme_guide : choisis le thème avec l'utilisateur.",
  "3. Lis le domaine permanent de la boutique (shop { myshopifyDomain }) avec le connecteur Shopify.",
  "4. prepare_theme_install, puis themeCreate en rôle UNPUBLISHED avec le lien renvoyé. Ne publie jamais sans validation explicite.",
  "5. Remplis les sections (themeFilesUpsert) et génère les images avec generate_section_image (importées avec fileCreate).",
  "6. Donne le lien d'aperçu, puis themePublish après validation.",
  "Les actions payantes (installation, image) débitent les crédits de l'agence : annonce le coût avant de les lancer en série.",
].join("\n");

export function registerWebuildTools(server: McpServer) {
  registerAccountTools(server);
  registerThemeTools(server);
  registerImageTools(server);
}
