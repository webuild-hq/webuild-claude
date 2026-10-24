import "server-only";
import { strToU8, strFromU8, zipSync } from "fflate";
import { readThemeFiles, readThemeLicense } from "./files";
import { injectLicense, LICENSE_SNIPPET_PATH, licenseSnippet, type LicenseParams } from "./license";

/** Construit le zip d'un thème verrouillé sur une boutique, prêt pour themeCreate. */
export async function buildThemeZip(slug: string, license: LicenseParams): Promise<Uint8Array> {
  const files = await readThemeFiles(slug);
  if (files.size === 0) {
    throw new Error(`Thème introuvable : ${slug}`);
  }

  for (const [path, content] of files) {
    if (path.startsWith("layout/") && path.endsWith(".liquid")) {
      files.set(path, strToU8(injectLicense(strFromU8(content))));
    }
  }
  files.set(LICENSE_SNIPPET_PATH, strToU8(licenseSnippet(license)));

  // Les licences d'origine (ex. Shopify Skeleton) exigent que leur texte accompagne chaque copie.
  const upstreamLicense = await readThemeLicense(slug);
  if (upstreamLicense) {
    files.set(
      "snippets/upstream-license.liquid",
      strToU8(`{%- comment -%}\n${upstreamLicense.replaceAll("{%", "{ %")}\n{%- endcomment -%}\n`),
    );
  }

  return zipSync(Object.fromEntries(files), { level: 6 });
}
