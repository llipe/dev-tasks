import { defineConfig } from "vitest/config";

// Defect 1: renders React components but declares a bare node environment.
// Defect 3: no `resolve.alias`, so the `@/` alias in tsconfig.json is unresolved
// at test time -- the first `import "@/lib/api"` passes tsc and fails here.
export default defineConfig({
  test: {
    environment: "node",
    // Defect 4 contributor: restoreMocks not enabled, so cleanup is manual.
  },
});
