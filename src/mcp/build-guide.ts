import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SKILL_FILE = join(process.cwd(), "skills", "webuild-store-builder", "SKILL.md");

let cached: Promise<string> | undefined;

/** Méthode complète de construction d'une boutique : le contenu de la skill, sans son en-tête. */
export function readBuildGuide(): Promise<string> {
  cached ??= readFile(SKILL_FILE, "utf8").then((content) => content.replace(/^---\n[\s\S]*?\n---\n+/, "").trim());
  return cached;
}
