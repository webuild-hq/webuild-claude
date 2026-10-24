import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "@/modules/themes/catalog";
import { Card, LinkButton } from "@/components/ui";

const STEPS = [
  {
    title: "Connecte Webuild à Claude",
    text: "Un connecteur à ajouter une fois, à côté du connecteur Shopify officiel.",
  },
  {
    title: "Décris la boutique",
    text: "Marque, produits, ambiance : Claude choisit le thème avec toi et prépare tout en brouillon.",
  },
  {
    title: "Valide et publie",
    text: "Sections remplies, images générées pour chaque emplacement, aperçu à valider avant publication.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <span className="text-lg font-semibold tracking-tight">Webuild</span>
        <Suspense>
          <HeaderAction />
        </Suspense>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">Pour les agences et freelances Shopify</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Des boutiques Shopify premium, construites par Claude.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Webuild donne à Claude un catalogue de thèmes haut de gamme et les outils pour les installer, les remplir et
          les illustrer sur les boutiques de tes clients. Chaque thème est livré à vie, verrouillé sur sa boutique.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/login">Commencer gratuitement</LinkButton>
          <LinkButton href="#themes" variant="secondary">Voir les thèmes</LinkButton>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card key={step.title} className="flex flex-col gap-2 p-6">
            <span className="text-sm text-muted">{index + 1}</span>
            <p className="font-semibold">{step.title}</p>
            <p className="text-sm text-muted">{step.text}</p>
          </Card>
        ))}
      </section>

      <section id="themes" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">Les thèmes</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {THEMES.map((theme) => (
            <Card key={theme.slug} className="overflow-hidden">
              <div
                className="flex h-44 items-end p-6"
                style={{ background: `linear-gradient(135deg, ${theme.accent[0]}, ${theme.accent[1]})` }}
              >
                <span className="text-3xl font-semibold tracking-tight text-white drop-shadow">{theme.name}</span>
              </div>
              <div className="flex flex-col gap-2 p-6">
                <p className="font-medium">{theme.tagline}</p>
                <p className="text-sm text-muted">{theme.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl justify-between px-4 py-6 text-sm text-muted">
          <span>Webuild</span>
          <Link href="/login" className="hover:text-foreground">
            Connexion
          </Link>
        </div>
      </footer>
    </main>
  );
}

async function HeaderAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data ? (
    <LinkButton href="/dashboard">Ouvrir le dashboard</LinkButton>
  ) : (
    <LinkButton href="/login" variant="secondary">Connexion</LinkButton>
  );
}
