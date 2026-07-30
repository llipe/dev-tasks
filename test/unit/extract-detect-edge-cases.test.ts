import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { runDetection, registerProvider, clearProviders } from "#core/extract/detect.js";
import { nodeTsProvider } from "#core/extract/providers/node-ts.js";

describe("extract detect — edge cases", () => {
  beforeEach(() => {
    clearProviders();
    registerProvider(nodeTsProvider);
  });

  it("returns null when no package.json exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "no-pkg-"));
    const result = runDetection({ rootDir: dir });
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON in package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "bad-json-"));
    writeFileSync(join(dir, "package.json"), "{ invalid json }");
    const result = runDetection({ rootDir: dir });
    expect(result).toBeNull();
  });

  it("handles package.json with empty dependencies", () => {
    const dir = mkdtempSync(join(tmpdir(), "empty-deps-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "empty", version: "1.0.0" }));
    // No dependencies at all — should still detect as a Node project (package.json exists)
    // but won't have TS, framework, ORM, or messaging
    const result = runDetection({ rootDir: dir });
    // With no deps at all, the object is empty — isNode checks for any key
    expect(result).toBeNull();
  });

  it("detects multiple ORMs — returns first match (prisma priority)", () => {
    const dir = mkdtempSync(join(tmpdir(), "multi-orm-"));
    mkdirSync(join(dir, "prisma"), { recursive: true });
    writeFileSync(join(dir, "prisma/schema.prisma"), "model User {}");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "multi-orm",
        version: "1.0.0",
        dependencies: {
          "@prisma/client": "^5.0.0",
          "drizzle-orm": "^0.30.0",
          typeorm: "^0.3.0",
          express: "^4.18.0",
        },
        devDependencies: {
          prisma: "^5.0.0",
          typescript: "^5.0.0",
        },
      }),
    );

    const result = runDetection({ rootDir: dir });
    expect(result).not.toBeNull();
    // Prisma has priority
    expect(result!.orm!.kind).toBe("prisma");
    expect(result!.orm!.schema_path).toBe("prisma/schema.prisma");
  });

  it("handles monorepo-shaped dir — detects single package at root", () => {
    const dir = mkdtempSync(join(tmpdir(), "monorepo-"));
    // Root has a package.json (workspace root)
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "monorepo-root",
        version: "1.0.0",
        private: true,
        dependencies: {},
        devDependencies: { typescript: "^5.0.0" },
      }),
    );
    // A sub-package with nestjs
    mkdirSync(join(dir, "packages/api"), { recursive: true });
    writeFileSync(
      join(dir, "packages/api/package.json"),
      JSON.stringify({
        name: "@monorepo/api",
        dependencies: { "@nestjs/core": "^10.0.0" },
      }),
    );

    // Detection at root level — sees only root package.json
    const result = runDetection({ rootDir: dir });
    expect(result).not.toBeNull();
    // Root has only TS, no framework
    expect(result!.http).toBeNull();
    expect(result!.type_hint).toBe("node-ts-no-framework");
  });

  it("detects project with only devDependencies as a Node project", () => {
    const dir = mkdtempSync(join(tmpdir(), "dev-deps-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "dev-only",
        version: "1.0.0",
        devDependencies: {
          typescript: "^5.0.0",
          express: "^4.18.0",
        },
      }),
    );

    const result = runDetection({ rootDir: dir });
    expect(result).not.toBeNull();
    expect(result!.stack).toContain("typescript");
    expect(result!.http).not.toBeNull();
    expect(result!.http!.framework).toBe("express");
  });

  it("handles Prisma without schema file present", () => {
    const dir = mkdtempSync(join(tmpdir(), "prisma-no-schema-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "no-schema",
        version: "1.0.0",
        dependencies: { "@prisma/client": "^5.0.0", express: "^4.18.0" },
        devDependencies: { typescript: "^5.0.0" },
      }),
    );

    const result = runDetection({ rootDir: dir });
    expect(result).not.toBeNull();
    expect(result!.orm!.kind).toBe("prisma");
    expect(result!.orm!.schema_path).toBeNull();
  });
});
