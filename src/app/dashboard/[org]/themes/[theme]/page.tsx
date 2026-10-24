import Link from "next/link";
import { notFound } from "next/navigation";
import { getTheme } from "@/modules/themes/catalog";
import { readThemeGuide } from "@/modules/themes/files";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadOrganization } from "../../context";

const TEMPLATE_LABELS: Record<string, string> = {
  index: "Accueil",
  product: "Produit",
  collection: "Collection",
  "list-collections": "Liste des collections",
  cart: "Panier",
  search: "Recherche",
  blog: "Blog",
  article: "Article",
  page: "Page",
  "page.about": "À propos",
  "page.contact": "Contact",
  "404": "Page 404",
  password: "Mot de passe",
};

export default async function ThemePage({ params }: PageProps<"/dashboard/[org]/themes/[theme]">) {
  const { org: slug, theme: themeSlug } = await params;
  await loadOrganization(slug, `/themes/${themeSlug}`);
  const theme = getTheme(themeSlug);
  if (!theme) notFound();
  const guide = await readThemeGuide(theme.slug);

  const pages = Object.entries(guide.templates).filter(([, t]) => t.sections?.length);

  return (
    <>
      <Link href={`/dashboard/${slug}/themes`} className="text-sm text-muted hover:text-foreground">
        &larr; Tous les thèmes
      </Link>
      <div
        className="flex h-48 items-end rounded-2xl p-6"
        style={{ background: `linear-gradient(135deg, ${theme.accent[0]}, ${theme.accent[1]})` }}
      >
        <span className="text-4xl font-semibold tracking-tight text-white drop-shadow">{theme.name}</span>
      </div>
      <PageHeader title={theme.tagline} description={theme.description} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="font-semibold">Points forts</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {theme.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {theme.bestFor.map((use) => (
              <Badge key={use}>{use}</Badge>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="font-semibold">L&apos;installer avec Claude</h2>
          <p className="text-sm">Demande simplement :</p>
          <p className="rounded-lg bg-background px-3 py-2 text-sm italic">
            &laquo; Installe le thème {theme.name} de Webuild sur ma boutique Shopify, en brouillon, et adapte-le à
            ma marque. &raquo;
          </p>
          <p className="text-xs text-muted">
            Claude prépare un zip verrouillé sur la boutique, l&apos;installe sans le publier, remplit les sections et
            te donne un lien d&apos;aperçu avant publication.
          </p>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Pages et sections</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {pages.map(([name, template]) => (
            <Card key={name} className="flex flex-col gap-2 p-5">
              <p className="font-medium">{TEMPLATE_LABELS[name] ?? name}</p>
              <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-sm text-muted">
                {template.sections!.map((s) => (
                  <li key={s.id}>{(s.type && guide.sections[s.type]?.name) ?? s.type ?? s.id}</li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Toutes les sections ({Object.keys(guide.sections).length})</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(guide.sections).map(([type, s]) => (
            <Badge key={type}>{s.name}</Badge>
          ))}
        </div>
      </section>
    </>
  );
}
