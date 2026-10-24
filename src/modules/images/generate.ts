import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";

export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** Coût estimé d'une image chez le fournisseur, en centimes (pour mesurer les marges). */
export const ESTIMATED_COST_CENTS = 4;

export function imageModel() {
  return process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
}

export function isImageGenerationConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Génère une image avec Gemini et renvoie ses octets. */
export async function generateImage(prompt: string, aspectRatio: AspectRatio) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY manquant");
  }

  // GEMINI_BASE_URL (facultatif) : passerelle ou proxy devant l'API Gemini.
  const baseUrl = process.env.GEMINI_BASE_URL;
  const ai = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
  const response = await ai.models.generateContent({
    model: imageModel(),
    contents: prompt,
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error("Aucune image renvoyée par le modèle");
  }
  return {
    bytes: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType ?? "image/png",
  };
}

/** Consigne commune à toutes les images : rendu e-commerce premium, sans texte incrusté. */
export function buildImagePrompt(params: {
  brief: string;
  themeName?: string;
  sectionName?: string;
  settingLabel?: string;
}) {
  const context = [
    params.themeName && `Thème Shopify : ${params.themeName}.`,
    params.sectionName && `Section : ${params.sectionName}.`,
    params.settingLabel && `Emplacement : ${params.settingLabel}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "Photographie e-commerce haut de gamme, lumière soignée, composition épurée, rendu réaliste.",
    "Aucun texte, logo, filigrane ni typographie dans l'image.",
    "Laisser un espace de respiration pour un éventuel texte superposé par le thème.",
    context,
    `Sujet : ${params.brief}`,
  ]
    .filter(Boolean)
    .join("\n");
}
