import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

const SKILL = "webuild-store-builder";

/** Skill Claude à importer dans Claude (Paramètres, Capacités, Skills) : un zip contenant le dossier de la skill. */
export async function GET() {
  const content = await readFile(join(process.cwd(), "skills", SKILL, "SKILL.md"), "utf8");
  const zip = zipSync({ [`${SKILL}/SKILL.md`]: strToU8(content) });

  return new Response(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${SKILL}.zip"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
