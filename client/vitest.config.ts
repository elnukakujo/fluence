import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest (CJS Vite) can't load the string-form PostCSS plugins Next.js uses,
  // so give it an empty PostCSS config for the pure-TS tests (no CSS imported).
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
