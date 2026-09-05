import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

const BANNER = `/*! Fibbers v${pkg.version} — GENERATED from src/ by 'bun run build'. Do not hand-edit. */`;

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Prepend the banner in `generateBundle` — which runs AFTER esbuild's minifier
 * (a rollup `output.banner` or a `renderChunk` hook gets stripped by minify).
 */
const bannerPlugin = (): Plugin => ({
  name: "fibbers-banner",
  enforce: "post",
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === "chunk" && file.fileName === "fibbers.js") {
        file.code = `${BANNER}\n${file.code}`;
      }
    }
  },
});

export default defineConfig(({ mode }) => {
  const dev = mode === "development";
  return {
    // Dev keeps the rollup banner below (no minify to strip it); prod re-adds it
    // post-minify via the plugin.
    plugins: dev ? [] : [bannerPlugin()],
    define: {
      // Lit reads process.env.NODE_ENV to gate dev-mode warnings; Vite doesn't
      // define it in lib builds, so we do it here (matches the old bun --define).
      "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
    },
    resolve: {
      alias: {
        "@shared": alias("./src/shared"),
        "@core": alias("./src/core"),
        "@cards": alias("./src/cards"),
        "@": alias("./src"),
      },
    },
    build: {
      target: "es2022",
      outDir: "dist",
      emptyOutDir: false, // dist also holds icons.full.json — don't wipe it
      minify: !dev,
      sourcemap: dev,
      lib: {
        entry: "src/index.ts",
        formats: ["iife"],
        name: "Fibbers",
        fileName: () => "fibbers.js",
      },
      rollupOptions: {
        // Bundle everything (lit, @lit-labs/signals, …) into one self-contained
        // IIFE — HACS serves a single file. Nothing is externalized.
        output: { banner: BANNER },
      },
    },
  };
});
