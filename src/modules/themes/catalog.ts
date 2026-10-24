export type ThemeEntry = {
  slug: string;
  name: string;
  version: string;
  tagline: string;
  description: string;
  bestFor: string[];
  highlights: string[];
  /** Dégradé utilisé comme visuel tant qu'il n'y a pas de captures d'écran. */
  accent: [string, string];
};

/**
 * Catalogue des thèmes Webuild. Les sources sont dans themes/<slug>/.
 * Pour l'instant, un seul thème de test (Skeleton de Shopify, v1.0.0) en attendant les vrais thèmes.
 */
export const THEMES: ThemeEntry[] = [
  {
    slug: "skeleton",
    name: "Skeleton",
    version: "1.0.0",
    tagline: "Thème de test, minimal, pour valider l'installation de bout en bout.",
    description:
      "Le thème de départ officiel de Shopify (Skeleton theme v1.0.0) : structure propre, sections essentielles, " +
      "templates JSON. Sert à tester le parcours complet avec Claude avant l'arrivée des thèmes premium.",
    bestFor: ["Tests", "Démonstration"],
    highlights: [
      "Pages essentielles : accueil, produit, collection, panier, recherche, blog",
      "Section personnalisable avec image de fond",
      "Header et footer configurables",
    ],
    accent: ["#e7e5e4", "#57534e"],
  },
];

export function getTheme(slug: string): ThemeEntry | undefined {
  return THEMES.find((theme) => theme.slug === slug.toLowerCase());
}
