import { describe, it, expect } from "vitest";
import { reconcile, type ReconcileAction } from "#core/reconcile.js";

describe("core/reconcile", () => {
  describe("reconcile()", () => {
    it("returns 'install' when file does not exist locally (localHash is null)", () => {
      const result = reconcile(null, "origin123", "package456");
      expect(result).toBe("install");
    });

    it("returns 'overwrite' when local hash equals origin hash but differs from package hash (unedited, upstream changed)", () => {
      const originHash = "abc123";
      const packageHash = "def456";
      const localHash = originHash; // user hasn't edited
      const result = reconcile(localHash, originHash, packageHash);
      expect(result).toBe("overwrite");
    });

    it("returns 'skip' when local hash equals package hash (already up to date)", () => {
      const packageHash = "abc123";
      const localHash = packageHash;
      const originHash = "whatever"; // doesn't matter
      const result = reconcile(localHash, originHash, packageHash);
      expect(result).toBe("skip");
    });

    it("returns 'conflict' when local hash differs from origin AND from package (user edited, upstream changed)", () => {
      const localHash = "user-edit-hash";
      const originHash = "original-hash";
      const packageHash = "new-package-hash";
      const result = reconcile(localHash, originHash, packageHash);
      expect(result).toBe("conflict");
    });

    it("returns 'skip' when all three hashes are equal (nothing changed anywhere)", () => {
      const hash = "all-same-hash";
      const result = reconcile(hash, hash, hash);
      expect(result).toBe("skip");
    });

    it("returns 'skip' when local hash equals package hash even if origin differs", () => {
      // User edited to match the new package version (convergent edit)
      const result = reconcile("pkg-hash", "old-origin", "pkg-hash");
      expect(result).toBe("skip");
    });

    it("returns 'conflict' when local hash differs from origin and package (user-modified file with upstream update)", () => {
      const result = reconcile("user-custom", "original", "new-upstream");
      expect(result).toBe("conflict");
    });

    it("returns 'overwrite' when local == origin and both differ from package", () => {
      const result = reconcile("origin-val", "origin-val", "new-pkg-val");
      expect(result).toBe("overwrite");
    });

    it("install case takes priority when localHash is null regardless of other hashes", () => {
      const result = reconcile(null, "any-origin", "any-package");
      expect(result).toBe("install");
    });
  });

  describe("return type", () => {
    it("returns a valid ReconcileAction literal", () => {
      const validActions: ReconcileAction[] = ["install", "overwrite", "skip", "conflict"];
      const result = reconcile("a", "b", "c");
      expect(validActions).toContain(result);
    });
  });
});
