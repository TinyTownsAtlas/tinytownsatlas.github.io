import { defineConfig, loadEnv } from "vite";
import { myTen4tenDemo } from "./demo/my-ten4ten/vite-plugin.mjs";

// Base path for deployment. Defaults to "/", correct for this repo's actual target: an
// organization root Pages site served at https://tinytownsatlas.github.io/. Override with
// BASE_PATH only if this is ever redeployed as a project Pages site under a subpath instead.
//
// `--mode demo` adds the My TEN4TEN synthetic demo page (my-ten4ten/) and its synthetic data.
// The default build output is unchanged. See docs/MY_TEN4TEN.md.
export default defineConfig(({ mode, command }) => {
  const demo = mode === "demo";
  // `--mode demo` skips .env.production, so a demo *build* is given the same VITE_ values as a
  // production build (for example the assistant URL). Nothing is defined for default builds.
  const productionEnv = demo && command === "build" ? loadEnv("production", process.cwd(), "VITE_") : {};
  return {
    base: process.env.BASE_PATH ?? "/",
    define: Object.fromEntries(
      Object.entries(productionEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
    plugins: demo ? [myTen4tenDemo()] : [],
    server: {
      fs: {
        // Vite's defaults, plus the synthetic research store, which must never be served in dev.
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/demo/my-ten4ten/research/**"],
      },
    },
    build: {
      outDir: demo ? "dist-demo" : "dist",
      rollupOptions: demo
        ? { input: { main: "index.html", myTen4ten: "my-ten4ten/index.html" } }
        : undefined,
    },
  };
});
