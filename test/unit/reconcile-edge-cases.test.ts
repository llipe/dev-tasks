import { describe, it, expect } from "vitest";
import { reconcile } from "#core/reconcile.js";

describe("core/reconcile — edge cases", () => {
  describe("file deleted locally", () => {
    it("returns 'install' when file was deleted (localHash is null)", () => {
      // File existed before (origin hash known) but was deleted locally
      const result = reconcile(null, "original-hash", "package-hash");
      expect(result).toBe("install");
    });

    it("returns 'install' even if package hash matches origin (file deleted but unchanged upstream)", () => {
      const hash = "same-hash";
      const result = reconcile(null, hash, hash);
      expect(result).toBe("install");
    });
  });

  describe("file added to package (new skill)", () => {
    it("returns 'install' for new file with no local counterpart", () => {
      // Brand new file in package, never installed before
      const result = reconcile(null, "", "new-package-hash");
      expect(result).toBe("install");
    });
  });

  describe("identical content different mtime", () => {
    it("returns 'skip' when content hash matches package regardless of mtime", () => {
      // mtime doesn't matter — only hash comparison matters
      const hash = "content-hash-same";
      const result = reconcile(hash, "old-origin-hash", hash);
      expect(result).toBe("skip");
    });
  });

  describe("edge cases in hash equality", () => {
    it("empty string hashes are valid comparisons", () => {
      // All empty strings hash the same
      const result = reconcile("", "", "");
      expect(result).toBe("skip");
    });

    it("handles very long hash strings", () => {
      const longHash = "a".repeat(256);
      const differentHash = "b".repeat(256);
      const result = reconcile(longHash, longHash, differentHash);
      expect(result).toBe("overwrite");
    });

    it("origin equals package but local differs → conflict (user edited, package unchanged effectively)", () => {
      // This is the case where user edited but package hasn't changed from origin
      // local != origin AND local != package → conflict
      const result = reconcile("user-edited", "origin-same-as-pkg", "origin-same-as-pkg");
      expect(result).toBe("conflict");
    });
  });
});
