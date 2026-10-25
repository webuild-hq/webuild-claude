import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slugify";

/**
 * Images déposées par l'utilisateur (zone de dépôt affichée dans Claude). Bucket public, dossier = agence :
 * Shopify les télécharge depuis leur URL publique avec fileCreate. Seul le serveur écrit et liste (clé
 * secrète), toujours pour une agence dont l'appartenance a été vérifiée par l'appelant.
 */
export const CLIENT_IMAGES_BUCKET = "client-images";

/** Limite de Shopify pour une image, reprise par le bucket. */
export const CLIENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export const CLIENT_IMAGE_TYPES = Object.keys(EXTENSIONS);

export function isClientImageStorageConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export type ClientImage = { filename: string; url: string; size?: number; createdAt?: string };

type Validation = { contentType: string; size: number };

function validate({ contentType, size }: Validation): string | null {
  if (!EXTENSIONS[contentType]) return `Format non accepté (${contentType}). Formats : JPG, PNG, WebP, GIF, AVIF.`;
  if (size <= 0) return "Fichier vide.";
  if (size > CLIENT_IMAGE_MAX_BYTES) return "Image trop lourde : 20 Mo au plus.";
  return null;
}

/** Nom lisible et non devinable : le bucket est public. */
function storageFilename(original: string, contentType: string) {
  const base = slugify(original.replace(/\.[a-z0-9]+$/i, "")) || "image";
  return `${base}-${randomUUID().slice(0, 8)}.${EXTENSIONS[contentType]}`;
}

function publicUrl(path: string) {
  return createAdminClient().storage.from(CLIENT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Lien d'envoi signé (valable 2 heures) : le navigateur y envoie le fichier sans passer par Vercel. */
export async function createClientImageUpload(
  organizationId: string,
  file: Validation & { name: string },
): Promise<{ uploadUrl: string; image: ClientImage } | { error: string }> {
  const invalid = validate(file);
  if (invalid) return { error: invalid };

  const filename = storageFilename(file.name, file.contentType);
  const path = `${organizationId}/${filename}`;
  const { data, error } = await createAdminClient().storage.from(CLIENT_IMAGES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "Impossible de préparer l'envoi de l'image." };
  return { uploadUrl: data.signedUrl, image: { filename, url: publicUrl(path), size: file.size } };
}

/** Envoi de secours par le serveur, si le navigateur ne peut pas joindre Supabase directement. */
export async function storeClientImage(
  organizationId: string,
  file: { name: string; contentType: string; bytes: Buffer },
): Promise<{ image: ClientImage } | { error: string }> {
  const invalid = validate({ contentType: file.contentType, size: file.bytes.length });
  if (invalid) return { error: invalid };

  const filename = storageFilename(file.name, file.contentType);
  const path = `${organizationId}/${filename}`;
  const { error } = await createAdminClient()
    .storage.from(CLIENT_IMAGES_BUCKET)
    .upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (error) return { error: "L'image n'a pas pu être enregistrée." };
  return { image: { filename, url: publicUrl(path), size: file.bytes.length } };
}

export async function listClientImages(organizationId: string, limit = 100): Promise<ClientImage[]> {
  const { data, error } = await createAdminClient()
    .storage.from(CLIENT_IMAGES_BUCKET)
    .list(organizationId, { limit, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];
  return data
    .filter((object) => object.id && !object.name.startsWith("."))
    .map((object) => ({
      filename: object.name,
      url: publicUrl(`${organizationId}/${object.name}`),
      size: object.metadata?.size,
      createdAt: object.created_at ?? undefined,
    }));
}
