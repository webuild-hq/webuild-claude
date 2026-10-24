import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

/** Dossiers d'un thème Shopify : seuls ceux-ci sont livrés dans le zip. */
const THEME_FOLDERS = ["assets", "blocks", "config", "layout", "locales", "sections", "snippets", "templates"];

function themeDir(slug: string) {
  return join(process.cwd(), "themes", slug);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? listFiles(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)]),
    ),
  );
  return nested.flat();
}

/** Fichiers du thème, indexés par leur chemin dans le zip (ex. "layout/theme.liquid"). */
export async function readThemeFiles(slug: string): Promise<Map<string, Uint8Array>> {
  const root = themeDir(slug);
  const files = new Map<string, Uint8Array>();
  for (const folder of THEME_FOLDERS) {
    for (const path of await listFiles(join(root, folder))) {
      files.set(relative(root, path).split("\\").join("/"), new Uint8Array(await readFile(path)));
    }
  }
  return files;
}

/** Licence d'origine du thème (ex. Shopify Skeleton), à reproduire dans chaque copie livrée. */
export async function readThemeLicense(slug: string): Promise<string | null> {
  return readFile(join(themeDir(slug), "LICENSE.md"), "utf8").catch(() => null);
}

export type ThemeGuide = {
  theme: string;
  templates: Record<string, { file?: string; kind?: string; sections?: { id: string; type?: string }[] }>;
  sections: Record<
    string,
    {
      name: string;
      settings?: GuideSetting[];
      blocks?: { type: string; name?: string; settings?: GuideSetting[]; limit?: number }[];
      maxBlocks?: number;
      presets?: string[];
    }
  >;
  imageSettings: { section: string; block?: string; setting: string; label: string }[];
};

export type GuideSetting = {
  id: string;
  type: string;
  label?: string;
  default?: unknown;
  info?: string;
  options?: unknown[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

const guides = new Map<string, ThemeGuide>();

/** Guide généré par scripts/build-theme-guides.mjs. */
export async function readThemeGuide(slug: string): Promise<ThemeGuide> {
  const cached = guides.get(slug);
  if (cached) return cached;
  const guide = JSON.parse(await readFile(join(themeDir(slug), "guide.json"), "utf8")) as ThemeGuide;
  guides.set(slug, guide);
  return guide;
}
