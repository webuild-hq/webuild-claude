import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type AspectRatio,
  buildImagePrompt,
  ESTIMATED_COST_CENTS,
  generateImage,
  imageModel,
} from "./generate";

export const IMAGES_BUCKET = "generated-images";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type SectionImageRequest = {
  organizationId: string;
  userId: string;
  shopId: string | null;
  themeSlug: string;
  themeName: string;
  section: string;
  sectionName?: string;
  setting?: string;
  settingLabel?: string;
  brief: string;
  aspectRatio: AspectRatio;
  /** Clé anti-doublon fournie par l'appelant (un même appel relancé ne débite qu'une fois). */
  requestId: string;
};

/**
 * Débite les crédits, génère l'image, la stocke (dossier = agence, via RLS de l'utilisateur)
 * et l'enregistre. En cas d'échec de génération, les crédits sont remboursés.
 */
export async function generateSectionImage(supabase: SupabaseClient, request: SectionImageRequest) {
  const { data: debit, error: debitError } = await supabase.rpc("consume_credits", {
    org: request.organizationId,
    credit_action: "image_generation",
    idempotency: `image:${request.requestId}`,
    ref_type: "section",
    ref_id: `${request.themeSlug}/${request.section}`,
    details: `Image ${request.themeName} : ${request.sectionName ?? request.section}`,
  });
  if (debitError || !debit) {
    return { error: debitError } as const;
  }

  // Appel relancé avec la même clé : l'image existe déjà.
  const { data: existing } = await supabase
    .from("image_generations")
    .select("public_url, storage_path")
    .eq("credit_transaction_id", debit.id)
    .eq("status", "completed")
    .maybeSingle();
  if (existing?.public_url) {
    return { image: { url: existing.public_url, filename: existing.storage_path.split("/").pop()! }, charged: 0 } as const;
  }

  const prompt = buildImagePrompt({
    brief: request.brief,
    themeName: request.themeName,
    sectionName: request.sectionName,
    settingLabel: request.settingLabel,
  });

  try {
    const { bytes, mimeType } = await generateImage(prompt, request.aspectRatio);
    const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] ?? "png";
    const filename = `${slugify(`${request.themeSlug}-${request.section}-${request.brief}`)}-${debit.id.slice(0, 8)}.${extension}`;
    const path = `${request.organizationId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;

    await supabase.from("image_generations").insert({
      organization_id: request.organizationId,
      shop_id: request.shopId,
      user_id: request.userId,
      theme_slug: request.themeSlug,
      section: request.section,
      setting: request.setting ?? null,
      prompt,
      aspect_ratio: request.aspectRatio,
      storage_path: path,
      public_url: publicUrl,
      status: "completed",
      model: imageModel(),
      credit_transaction_id: debit.id,
      provider_cost_cents: ESTIMATED_COST_CENTS,
    });

    return { image: { url: publicUrl, filename }, charged: -debit.amount } as const;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // Le remboursement est réservé au serveur : un membre ne doit pas pouvoir rembourser un débit lui-même.
    const { error: refundError } = await createAdminClient().rpc("refund_credits", {
      transaction_id: debit.id,
      details: "Image non générée",
    });
    if (refundError) {
      console.error("[images] remboursement impossible", debit.id, refundError);
    }
    await supabase.from("image_generations").insert({
      organization_id: request.organizationId,
      shop_id: request.shopId,
      user_id: request.userId,
      theme_slug: request.themeSlug,
      section: request.section,
      setting: request.setting ?? null,
      prompt,
      aspect_ratio: request.aspectRatio,
      status: "failed",
      model: imageModel(),
      error: message.slice(0, 500),
      credit_transaction_id: debit.id,
    });
    return { error: { message: "image_failed", details: message } } as const;
  }
}

export async function listGeneratedImages(supabase: SupabaseClient, organizationId: string, limit = 24) {
  const { data, error } = await supabase
    .from("image_generations")
    .select("id, public_url, theme_slug, section, aspect_ratio, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
