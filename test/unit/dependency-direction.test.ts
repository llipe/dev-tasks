import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const CORE_DIR = join(ROOT, "core");

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...getAllTsFiles(fullPath));
      } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist yet — OK for greenfield
  }
  return results;
}

describe("dependency direction", () => {
  it("core/ must not import from adapters/", () => {
    const coreFiles = getAllTsFiles(CORE_DIR);
    const violations: string[] = [];

    for (const file of coreFiles) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.match(/from\s+['"].*adapters\//) ||
          line.match(/from\s+['"]#adapters\//) ||
          line.match(/import\s*\(.*adapters\//)
        ) {
          const relativePath = file.replace(ROOT + "/", "");
          violations.push(`${relativePath}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    expect(violations, "Found adapter imports in core/:\n" + violations.join("\n")).toEqual([]);
  });
});
