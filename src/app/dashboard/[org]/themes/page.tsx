import Link from "next/link";
import { THEMES } from "@/modules/themes/catalog";
import { readThemeGuide } from "@/modules/themes/files";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadOrganization } from "../context";

export const metadata = { title: "Thèmes | Webuild" };

export default async function ThemesPage({ params }: PageProps<"/dashboard/[org]/themes">) {
  const { org: slug } = await params;
  await loadOrganization(slug, "/themes");
  const guides = await Promise.all(THEMES.map((theme) => readThemeGuide(theme.slug)));

  return (
    <>
      <PageHeader
        title="Thèmes"
        description="Thèmes premium installables par Claude, verrouillés sur la boutique de ton client et livrés à vie."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {THEMES.map((theme, index) => (
          <Link key={theme.slug} href={`/dashboard/${slug}/themes/${theme.slug}`} className="group">
            <Card className="flex h-full flex-col overflow-hidden transition group-hover:border-foreground/30">
              <div
                className="flex h-40 items-end p-5"
                style={{ background: `linear-gradient(135deg, ${theme.accent[0]}, ${theme.accent[1]})` }}
              >
                <span className="text-3xl font-semibold tracking-tight text-white drop-shadow">{theme.name}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <p className="font-medium">{theme.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {theme.bestFor.map((use) => (
                    <Badge key={use}>{use}</Badge>
                  ))}
                </div>
                <p className="mt-auto text-xs text-muted">
                  {Object.keys(guides[index].sections).length} sections · {guides[index].imageSettings.length}{" "}
                  emplacements d&apos;image · version {theme.version}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
