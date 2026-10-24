import { listGeneratedImages } from "@/modules/images/service";
import { isImageGenerationConfigured } from "@/modules/images/generate";
import { getTheme } from "@/modules/themes/catalog";
import { Card, EmptyState, formatDate, Notice, PageHeader } from "@/components/ui";
import { loadOrganization } from "../context";

export const metadata = { title: "Images | Webuild" };

export default async function ImagesPage({ params }: PageProps<"/dashboard/[org]/images">) {
  const { org: slug } = await params;
  const { supabase, organization } = await loadOrganization(slug, "/images");
  const images = await listGeneratedImages(supabase, organization.id, 60);

  return (
    <>
      <PageHeader
        title="Images"
        description="Images générées par Claude pour les sections des thèmes. Elles sont importées dans les fichiers de chaque boutique."
      />
      {!isImageGenerationConfigured() && (
        <Notice tone="warning">La génération d&apos;images n&apos;est pas encore activée sur ce serveur.</Notice>
      )}
      {images.length === 0 ? (
        <EmptyState title="Aucune image générée">
          Demande à Claude de générer les images de ta boutique, par exemple : &laquo; Génère l&apos;image du hero pour
          une marque de bougies artisanales. &raquo;
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <a href={image.public_url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- images hébergées sur Supabase Storage */}
                <img src={image.public_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              </a>
              <div className="flex flex-col gap-0.5 p-3 text-xs text-muted">
                <span className="font-medium text-foreground">
                  {getTheme(image.theme_slug ?? "")?.name ?? image.theme_slug} · {image.section}
                </span>
                <span>
                  {image.aspect_ratio} · {formatDate(image.created_at)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
