import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // test/fixtures holds inert fixture projects that reproduce defects on
    // purpose (see test/fixtures/qa-standards/README.md). Their .test.ts files
    // are shape, not suites, and must never be collected.
    exclude: ["**/node_modules/**", "**/dist/**", "test/fixtures/**"],
    // Disable file-level parallelism to prevent races between integration tests
    // that create/delete skills/ in the repo root. The suite takes a few minutes
    // this way; whether the race still exists is open (register item RF-001).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["core/**/*.ts", "bin/**/*.ts"],
      exclude: ["**/*.d.ts", "test/**"],
    },
  },
  resolve: {
    alias: [{ find: /^#core\/(.*)/, replacement: resolve(import.meta.dirname, "core/$1") }],
  },
});
