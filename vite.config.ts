import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { readdirSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// The site is deployed to GitHub Pages under /reference-radar/.
// VITE_BASE is set by the deploy workflow; local dev/preview uses "/".
const base = process.env.VITE_BASE || "/";

/** Injects the precache asset list into dist/sw.js after the build. */
function swPrecachePlugin(): Plugin {
  return {
    name: "rr-sw-precache",
    apply: "build",
    closeBundle() {
      const dist = resolve(process.cwd(), "dist");
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name !== "sw.js" && !full.includes("fonts")) files.push(`./${full.slice(dist.length + 1).split(sep).join("/")}`);
        }
      };
      walk(dist);
      const swPath = join(dist, "sw.js");
      if (existsSync(swPath)) {
        const list = JSON.stringify(["./", ...files]);
        appendFileSync(swPath, `\nself.__RR_PRECACHE = ${list};\n`);
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), swPrecachePlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          "pdf-export": ["pdf-lib", "@pdf-lib/fontkit"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/core/**"],
    },
  },
});
