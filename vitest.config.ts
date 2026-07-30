import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Disable file-level parallelism to prevent races between integration tests
    // that create/delete skills/ in the repo root. Suite is fast (~8s) so the
    // cost is negligible.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["core/**/*.ts", "adapters/**/*.ts", "bin/**/*.ts"],
      exclude: ["**/*.d.ts", "test/**"],
    },
  },
  resolve: {
    alias: [
      { find: /^#core\/(.*)/, replacement: resolve(import.meta.dirname, "core/$1") },
      { find: /^#adapters\/(.*)/, replacement: resolve(import.meta.dirname, "adapters/$1") },
    ],
  },
});
