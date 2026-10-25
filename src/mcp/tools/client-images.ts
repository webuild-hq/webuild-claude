import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { supabaseUrl } from "@/lib/env";
import {
  CLIENT_IMAGE_MAX_BYTES,
  CLIENT_IMAGE_TYPES,
  createClientImageUpload,
  isClientImageStorageConfigured,
  listClientImages,
  storeClientImage,
} from "@/modules/client-images/service";
import { errorResult, mcpContext, NOT_AUTHENTICATED, resolveAgency, textResult } from "../context";
import { MCP_APP_MIME_TYPE } from "../widgets/theme-catalog";
import { IMAGE_UPLOAD_HTML, IMAGE_UPLOAD_URI } from "../widgets/image-upload";

const NOT_CONFIGURED = "Le dépôt d'images n'est pas encore activé sur ce serveur Webuild.";

// Base64 de l'envoi de secours : le corps d'une requête Vercel est limité à 4,5 Mo.
const FALLBACK_MAX_BASE64 = 4_200_000;

export function registerClientImageTools(server: McpServer) {
  server.registerResource(
    "image-upload",
    IMAGE_UPLOAD_URI,
    { title: "Dépôt d'images Webuild", mimeType: MCP_APP_MIME_TYPE },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: MCP_APP_MIME_TYPE,
          text: IMAGE_UPLOAD_HTML,
          // Le navigateur envoie les fichiers directement dans Supabase Storage.
          _meta: { ui: { csp: { connectDomains: [supabaseUrl()], resourceDomains: [supabaseUrl()] } } },
        },
      ],
    }),
  );

  server.registerTool(
    "upload_client_images",
    {
      title: "Déposer des images",
      description:
        "Affiche dans la conversation une zone où l'utilisateur dépose ses propres images (photos de marque, de " +
        "produits, de ses clients). Webuild les stocke, puis l'utilisateur te renvoie leurs URL publiques, à importer " +
        "dans la boutique avec fileCreate. À utiliser dès que l'utilisateur veut utiliser ses images : une image jointe " +
        "à la conversation ne peut pas être transmise à Shopify. Gratuit.",
      inputSchema: z.object({
        agency: z.string().optional().describe("Slug de l'agence. Par défaut : l'agence par défaut."),
        shop_domain: z.string().optional().describe("Domaine myshopify.com de la boutique, pour retrouver l'agence."),
      }),
      _meta: { ui: { resourceUri: IMAGE_UPLOAD_URI } },
    },
    async ({ agency, shop_domain }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;
      if (!isClientImageStorageConfigured()) return errorResult(NOT_CONFIGURED);
      const resolved = await resolveAgency(context, { agency, shopDomain: shop_domain });
      if ("error" in resolved) return errorResult(resolved.error);

      return textResult({
        agency: resolved.organization.slug,
        maxFileSizeMb: CLIENT_IMAGE_MAX_BYTES / 1024 / 1024,
        next:
          "La zone de dépôt est affichée. Attends que l'utilisateur dépose ses images et te dise qu'il a terminé. " +
          "Si leurs URL ne sont pas dans ton contexte, appelle list_client_images (les plus récentes en premier). " +
          "Importe chacune avec fileCreate(files: { originalSource: <url>, filename, contentType: IMAGE }), puis " +
          "place-les dans le thème. Si la zone ne s'affiche pas, propose-lui de déposer ses images dans Shopify " +
          "(Contenu > Fichiers).",
      });
    },
  );

  server.registerTool(
    "list_client_images",
    {
      title: "Images déposées",
      description:
        "Liste les images que l'utilisateur a déjà déposées dans Webuild pour cette agence, avec leur URL publique " +
        "(à importer avec fileCreate si elles ne sont pas encore dans la boutique). Gratuit.",
      inputSchema: z.object({
        agency: z.string().optional().describe("Slug de l'agence. Par défaut : l'agence par défaut."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ agency }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;
      if (!isClientImageStorageConfigured()) return errorResult(NOT_CONFIGURED);
      const resolved = await resolveAgency(context, { agency });
      if ("error" in resolved) return errorResult(resolved.error);
      const images = await listClientImages(resolved.organization.id);
      return textResult({ agency: resolved.organization.slug, images });
    },
  );

  // Réservés à la zone de dépôt.
  const fileInput = {
    agency: z.string(),
    name: z.string().max(200),
    content_type: z.enum(CLIENT_IMAGE_TYPES as [string, ...string[]]),
  };

  server.registerTool(
    "create_image_upload",
    {
      title: "Préparer l'envoi d'une image",
      description: "Lien d'envoi signé pour une image déposée dans la zone de dépôt.",
      inputSchema: z.object({ ...fileInput, size: z.number().int().positive() }),
      _meta: { ui: { resourceUri: IMAGE_UPLOAD_URI, visibility: ["app"] } },
    },
    async ({ agency, name, content_type, size }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;
      if (!isClientImageStorageConfigured()) return errorResult(NOT_CONFIGURED);
      const resolved = await resolveAgency(context, { agency });
      if ("error" in resolved) return errorResult(resolved.error);
      const result = await createClientImageUpload(resolved.organization.id, { name, contentType: content_type, size });
      if ("error" in result) return errorResult(result.error);
      return textResult(result);
    },
  );

  server.registerTool(
    "upload_client_image",
    {
      title: "Envoyer une image",
      description: "Envoi de secours d'une image de la zone de dépôt, encodée en base64.",
      inputSchema: z.object({ ...fileInput, data: z.string().max(FALLBACK_MAX_BASE64) }),
      _meta: { ui: { resourceUri: IMAGE_UPLOAD_URI, visibility: ["app"] } },
    },
    async ({ agency, name, content_type, data }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;
      if (!isClientImageStorageConfigured()) return errorResult(NOT_CONFIGURED);
      const resolved = await resolveAgency(context, { agency });
      if ("error" in resolved) return errorResult(resolved.error);
      const result = await storeClientImage(resolved.organization.id, {
        name,
        contentType: content_type,
        bytes: Buffer.from(data, "base64"),
      });
      if ("error" in result) return errorResult(result.error);
      return { content: [{ type: "text" as const, text: `Image ${result.image.filename} enregistrée.` }], structuredContent: result };
    },
  );
}
