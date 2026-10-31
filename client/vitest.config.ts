import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  esbuild: { jsx: "automatic" }, // tsconfig has jsx:preserve for Next
  // Vitest (CJS Vite) can't load the string-form PostCSS plugins Next.js uses,
  // so give it an empty PostCSS config for the pure-TS tests (no CSS imported).
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
