import { defineConfig } from "vite";

// Base path for deployment. Defaults to "/", correct for this repo's actual target: an
// organization root Pages site served at https://tinytownsatlas.github.io/. Override with
// BASE_PATH only if this is ever redeployed as a project Pages site under a subpath instead.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  build: {
    outDir: "dist",
  },
});
