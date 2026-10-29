import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Convex function tests opt in per file with `// @vitest-environment edge-runtime`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
