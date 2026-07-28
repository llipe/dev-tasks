import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["core/**/*.ts", "adapters/**/*.ts", "bin/**/*.ts"],
      exclude: ["**/*.d.ts", "test/**"],
    },
  },
  resolve: {
    alias: {
      "#core": new URL("./core", import.meta.url).pathname,
      "#adapters": new URL("./adapters", import.meta.url).pathname,
    },
  },
});
