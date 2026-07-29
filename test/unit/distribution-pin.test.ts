import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writePin, readPin } from "#core/distribution/pin.js";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/pin", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-pin-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("writePin", () => {
    it("writes the version to .dev-tasks/version", async () => {
      await writePin(tmpDir, "1.2.3");
      const content = readFileSync(join(tmpDir, ".dev-tasks", "version"), "utf-8");
      expect(content.trim()).toBe("1.2.3");
    });

    it("creates .dev-tasks directory if missing", async () => {
      await writePin(tmpDir, "0.5.0");
      const content = readFileSync(join(tmpDir, ".dev-tasks", "version"), "utf-8");
      expect(content.trim()).toBe("0.5.0");
    });

    it("overwrites existing pin", async () => {
      await writePin(tmpDir, "1.0.0");
      await writePin(tmpDir, "2.0.0");
      const content = readFileSync(join(tmpDir, ".dev-tasks", "version"), "utf-8");
      expect(content.trim()).toBe("2.0.0");
    });
  });

  describe("readPin", () => {
    it("reads the pinned version from .dev-tasks/version", async () => {
      mkdirSync(join(tmpDir, ".dev-tasks"), { recursive: true });
      writeFileSync(join(tmpDir, ".dev-tasks", "version"), "1.5.0\n", "utf-8");
      const result = await readPin(tmpDir);
      expect(result).toBe("1.5.0");
    });

    it("returns null if no pin file exists", async () => {
      const result = await readPin(tmpDir);
      expect(result).toBeNull();
    });

    it("trims whitespace from the version", async () => {
      mkdirSync(join(tmpDir, ".dev-tasks"), { recursive: true });
      writeFileSync(join(tmpDir, ".dev-tasks", "version"), "  3.0.0  \n", "utf-8");
      const result = await readPin(tmpDir);
      expect(result).toBe("3.0.0");
    });
  });
});
