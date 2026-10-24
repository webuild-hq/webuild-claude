import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Les sources des thèmes sont lues à l'exécution : elles doivent être embarquées dans les fonctions.
  outputFileTracingIncludes: {
    "/api/themes/**": ["./themes/**/*"],
    "/api/mcp": ["./themes/*/guide.json", "./skills/**/*"],
    "/dashboard/**": ["./themes/*/guide.json"],
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
