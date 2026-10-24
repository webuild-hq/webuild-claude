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
  /** Boutique de démonstration du thème, ouverte par le bouton "Voir la démo". */
  previewUrl?: string;
};

/**
 * Catalogue des thèmes Webuild. Les sources sont dans themes/<slug>/, les captures d'écran du catalogue
 * dans themes/<slug>/screenshots/ (jpg, png ou webp, affichées dans l'ordre des noms de fichiers).
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
  {
    slug: "mist",
    name: "Mist",
    version: "1.0.0",
    tagline: "Beauté et soin, doux et éditorial, pensé pour mettre les produits en scène.",
    description:
      "Thème pour les marques de beauté, de soin et de parfum. Une page d'accueil qui raconte la marque : " +
      "bandeau promo, cartes produits mises en avant, bandeau défilant d'images, sélection \"Currently obsessed\", " +
      "vidéos en défilement, citations presse et avis clients, puis une déclaration de marque. Base Dawn 15.5.",
    bestFor: ["Beauté", "Soin", "Parfum"],
    highlights: [
      "Accueil éditorial en 13 sections, prêt à remplir",
      "Cartes produits, image avec produits et sélection \"Currently obsessed\"",
      "Bandeaux défilants d'images et de vidéos",
      "Citations presse, avis clients, FAQ et engagements de marque",
      "Tiroir panier, recherche prédictive et commande rapide",
    ],
    accent: ["#F4E3E7", "#8c5a66"],
  },
];

export function getTheme(slug: string): ThemeEntry | undefined {
  return THEMES.find((theme) => theme.slug === slug.toLowerCase());
}
