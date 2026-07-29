import { describe, it, expect } from "vitest";
import { hashContent, hashFile } from "#core/distribution/hash.js";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("core/distribution/hash", () => {
  describe("hashContent", () => {
    it("returns a SHA-256 hex digest of the input string", () => {
      const content = "hello world";
      const expected = createHash("sha256").update(content).digest("hex");
      expect(hashContent(content)).toBe(expected);
    });

    it("returns deterministic output for same input", () => {
      const content = "deterministic test";
      expect(hashContent(content)).toBe(hashContent(content));
    });

    it("produces different hashes for different inputs", () => {
      expect(hashContent("aaa")).not.toBe(hashContent("bbb"));
    });

    it("handles empty string", () => {
      const expected = createHash("sha256").update("").digest("hex");
      expect(hashContent("")).toBe(expected);
    });

    it("handles multi-line content", () => {
      const content = "line1\nline2\nline3";
      const expected = createHash("sha256").update(content).digest("hex");
      expect(hashContent(content)).toBe(expected);
    });

    it("handles unicode content", () => {
      const content = "日本語テスト 🎉";
      const expected = createHash("sha256").update(content).digest("hex");
      expect(hashContent(content)).toBe(expected);
    });
  });

  describe("hashFile", () => {
    let tmpDir: string;

    function setup() {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-hash-test-"));
    }

    function teardown() {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    it("returns the SHA-256 hash of a file's content", async () => {
      setup();
      try {
        const filePath = join(tmpDir, "test.txt");
        const content = "file content for hashing";
        writeFileSync(filePath, content, "utf-8");

        const expected = createHash("sha256").update(content).digest("hex");
        const result = await hashFile(filePath);
        expect(result).toBe(expected);
      } finally {
        teardown();
      }
    });

    it("throws for a non-existent file", async () => {
      await expect(hashFile("/nonexistent/path/file.txt")).rejects.toThrow();
    });

    it("handles an empty file", async () => {
      setup();
      try {
        const filePath = join(tmpDir, "empty.txt");
        writeFileSync(filePath, "", "utf-8");

        const expected = createHash("sha256").update("").digest("hex");
        const result = await hashFile(filePath);
        expect(result).toBe(expected);
      } finally {
        teardown();
      }
    });
  });
});
