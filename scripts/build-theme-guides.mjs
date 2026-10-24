#!/usr/bin/env node
// Génère themes/<slug>/guide.json à partir des schémas Liquid de chaque thème.
// Ce guide est ce que Claude lit (outil get_theme_guide) pour remplir les sections.
// Usage : node scripts/build-theme-guides.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const THEMES_DIR = new URL("../themes/", import.meta.url).pathname;

// Réglages purement visuels de l'éditeur, inutiles pour remplir une section.
const SKIPPED_TYPES = new Set(["header", "paragraph"]);

function stripJsonComments(text) {
  return text.replace(/^\s*\/\*[\s\S]*?\*\//, "");
}

function readSchema(file) {
  const source = readFileSync(file, "utf8");
  const match = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  return match ? parseLenientJson(match[1]) : null;
}

// Shopify tolère les virgules finales dans ses JSON, JSON.parse non.
function parseLenientJson(text) {
  return JSON.parse(stripJsonComments(text).replace(/,(\s*[}\]])/g, "$1"));
}

function loadTranslations(themeDir) {
  const file = join(themeDir, "locales", "en.default.schema.json");
  return existsSync(file) ? parseLenientJson(readFileSync(file, "utf8")) : {};
}

function translate(value, translations) {
  if (typeof value !== "string" || !value.startsWith("t:")) return value;
  const resolved = value
    .slice(2)
    .split(".")
    .reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), translations);
  return typeof resolved === "string" ? resolved : value;
}

function compactSetting(setting, t) {
  const out = { id: setting.id, type: setting.type };
  const label = translate(setting.label, t);
  if (label) out.label = label;
  if (setting.default !== undefined) out.default = setting.default;
  if (setting.info) out.info = translate(setting.info, t);
  if (setting.type === "range") {
    out.min = setting.min;
    out.max = setting.max;
    if (setting.step !== undefined) out.step = setting.step;
    if (setting.unit) out.unit = setting.unit;
  }
  if (setting.options) {
    out.options = setting.options.map((option) => option.value);
  }
  return out;
}

function compactSettings(settings = [], t) {
  return settings.filter((s) => s.id && !SKIPPED_TYPES.has(s.type)).map((s) => compactSetting(s, t));
}

function compactBlocks(blocks = [], t) {
  return blocks.map((block) => {
    const out = { type: block.type };
    const name = translate(block.name, t);
    if (name) out.name = name;
    const settings = compactSettings(block.settings, t);
    if (settings.length) out.settings = settings;
    if (block.limit) out.limit = block.limit;
    return out;
  });
}

function readTemplates(themeDir) {
  const dir = join(themeDir, "templates");
  const templates = {};
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) {
      templates[basename(file)] = { kind: "liquid" };
      continue;
    }
    const json = parseLenientJson(readFileSync(join(dir, file), "utf8"));
    templates[file.replace(/\.json$/, "")] = {
      file: `templates/${file}`,
      sections: (json.order ?? Object.keys(json.sections ?? {})).map((id) => ({
        id,
        type: json.sections?.[id]?.type,
      })),
    };
  }
  return templates;
}

function buildGuide(slug) {
  const themeDir = join(THEMES_DIR, slug);
  const t = loadTranslations(themeDir);
  const sections = {};
  const imageSettings = [];

  for (const file of readdirSync(join(themeDir, "sections")).sort()) {
    if (!file.endsWith(".liquid")) continue;
    const type = file.replace(/\.liquid$/, "");
    const schema = readSchema(join(themeDir, "sections", file));
    if (!schema) continue;

    const settings = compactSettings(schema.settings, t);
    const blocks = compactBlocks(schema.blocks, t);
    sections[type] = {
      name: translate(schema.name, t) ?? type,
      ...(settings.length ? { settings } : {}),
      ...(blocks.length ? { blocks } : {}),
      ...(schema.max_blocks ? { maxBlocks: schema.max_blocks } : {}),
      ...(schema.presets?.length ? { presets: schema.presets.map((p) => translate(p.name, t)) } : {}),
    };

    for (const setting of settings.filter((s) => s.type === "image_picker")) {
      imageSettings.push({ section: type, setting: setting.id, label: setting.label ?? setting.id });
    }
    for (const block of blocks) {
      for (const setting of (block.settings ?? []).filter((s) => s.type === "image_picker")) {
        imageSettings.push({
          section: type,
          block: block.type,
          setting: setting.id,
          label: setting.label ?? setting.id,
        });
      }
    }
  }

  return {
    theme: slug,
    generatedFrom: "Schémas {% schema %} des sections et templates JSON du thème",
    templates: readTemplates(themeDir),
    sections,
    imageSettings,
  };
}

for (const slug of readdirSync(THEMES_DIR)) {
  if (!existsSync(join(THEMES_DIR, slug, "sections"))) continue;
  const guide = buildGuide(slug);
  writeFileSync(join(THEMES_DIR, slug, "guide.json"), JSON.stringify(guide, null, 2) + "\n");
  console.log(
    `${slug}: ${Object.keys(guide.sections).length} sections, ` +
      `${Object.keys(guide.templates).length} templates, ${guide.imageSettings.length} images`,
  );
}
