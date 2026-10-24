import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Les sources des thèmes sont lues à l'exécution : elles doivent être embarquées dans les fonctions.
  outputFileTracingIncludes: {
    // Le zip d'une livraison est construit par prepare_theme_install (MCP) et par le bouton du dashboard.
    "/api/mcp": ["./themes/**/*", "./skills/**/*"],
    "/dashboard/**": ["./themes/**/*"],
    "/api/skill/**": ["./skills/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
