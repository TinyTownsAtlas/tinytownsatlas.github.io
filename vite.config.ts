import { defineConfig } from "vite";

// Base path for GitHub Pages project sites (username.github.io/tiny-towns-atlas/).
// Override with BASE_PATH env var; defaults to "/" for local dev/build.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  build: {
    outDir: "dist",
  },
});
