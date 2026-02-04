import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://relics.runetools.lol",
  output: "static",
  trailingSlash: "always",

  build: {
    format: "directory",
  },

  integrations: [sitemap()],
});
