import type { McpServer } from "@modelcontextprotocol/server";
import { registerAccountTools } from "./tools/account";
import { registerGuideTools } from "./tools/guide";
import { registerImageTools } from "./tools/images";
import { registerThemeTools } from "./tools/themes";

export const MCP_INSTRUCTIONS = [
  "Webuild fournit des thèmes Shopify premium et les outils pour construire une boutique complète avec le connecteur Shopify.",
  "Avant de créer ou de refaire une boutique, appelle get_build_guide (gratuit) et suis la méthode qu'il renvoie.",
  "Règles essentielles :",
  "- Si l'utilisateur a plusieurs agences (list_my_agencies) et n'a rien précisé, demande laquelle utiliser.",
  "- Le thème est toujours installé en brouillon (themeCreate, rôle UNPUBLISHED) ; ne publie jamais sans validation explicite.",
  "- Les actions payantes (installation, image) débitent les crédits de l'agence : annonce le coût avant de les lancer.",
].join("\n");

export function registerWebuildTools(server: McpServer) {
  registerAccountTools(server);
  registerGuideTools(server);
  registerThemeTools(server);
  registerImageTools(server);
}
