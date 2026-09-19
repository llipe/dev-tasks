/**
 * Unit tests for the foundation-doc migration (S-002, FR-45).
 *
 * `dev-tasks migrate docs` proposes by default and applies only under
 * `--force`. The two concerns are exported separately so `doctor` can
 * reuse detection without reaching the mutation path.
 *
 * Note the asymmetry this story deliberately introduces (D-52): the bare
 * `dev-tasks migrate` is detect-and-**apply** — `runMigration()` takes no
 * options and writes the manifest unconditionally. `migrate docs` is the
 * first sub-verb to propose by default. Changing the legacy path would
 * alter a shipped command's default behavior, so it is left alone.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { detectOldFoundationDocs, runDocsMigration } from "../../core/distribution/migrate-docs.js";

const PRODUCT_BODY = "# Product Context\n\nWhat this product is.\n";
const TECH_BODY = "# Technical Guidelines\n\nHow we build it.\n";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

let repo: string;

async function seed(files: Record<string, string>): Promise<void> {
  await mkdir(join(repo, "docs"), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    await writeFile(join(repo, rel), body, "utf-8");
  }
}

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), "dt-migrate-docs-"));
});

afterEach(async () => {
  // Restore permissions first: a read-only-directory case would otherwise
  // make the temp tree undeletable and leak into later runs.
  try {
    await chmod(join(repo, "docs"), 0o755);
  } catch {
    /* directory may not exist */
  }
  await rm(repo, { recursive: true, force: true });
});

describe("detectOldFoundationDocs", () => {
  it("finds both old documents when both are present", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY, "docs/technical-guidelines.md": TECH_BODY });
    const found = await detectOldFoundationDocs(repo);
    expect(found.map((f) => f.from).sort()).toEqual([
      "docs/product-context.md",
      "docs/technical-guidelines.md",
    ]);
    expect(found.map((f) => f.to).sort()).toEqual(["docs/product.md", "docs/tech.md"]);
  });

  it("finds one when only one is present", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY });
    const found = await detectOldFoundationDocs(repo);
    expect(found).toHaveLength(1);
    expect(found[0].from).toBe("docs/product-context.md");
  });

  it("finds none in an already-migrated repository", async () => {
    await seed({ "docs/product.md": PRODUCT_BODY, "docs/tech.md": TECH_BODY });
    expect(await detectOldFoundationDocs(repo)).toEqual([]);
  });

  it("finds none in a repository with no docs directory at all", async () => {
    expect(await detectOldFoundationDocs(repo)).toEqual([]);
  });

  it("reports a partial migration: old and new both present", async () => {
    await seed({
      "docs/product-context.md": PRODUCT_BODY,
      "docs/product.md": PRODUCT_BODY,
      "docs/technical-guidelines.md": TECH_BODY,
    });
    const found = await detectOldFoundationDocs(repo);
    const product = found.find((f) => f.from === "docs/product-context.md");
    expect(product?.targetExists).toBe(true);
    const tech = found.find((f) => f.from === "docs/technical-guidelines.md");
    expect(tech?.targetExists).toBe(false);
  });
});

describe("runDocsMigration — propose (default)", () => {
  it("mutates nothing and reports what it would do", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY, "docs/technical-guidelines.md": TECH_BODY });
    const result = await runDocsMigration(repo, { apply: false });

    expect(result.applied).toBe(false);
    expect(result.renames).toHaveLength(2);
    expect(existsSync(join(repo, "docs/product-context.md"))).toBe(true);
    expect(existsSync(join(repo, "docs/product.md"))).toBe(false);
    expect(existsSync(join(repo, ".dev-tasks"))).toBe(false);
  });

  it("lists consumer-owned files that still reference the old names", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY });
    await writeFile(join(repo, "CLAUDE.md"), "See docs/product-context.md for context.\n", "utf-8");
    await writeFile(join(repo, "AGENTS.md"), "Nothing relevant here.\n", "utf-8");

    const result = await runDocsMigration(repo, { apply: false });
    expect(result.consumerReferences).toContain("CLAUDE.md");
    expect(result.consumerReferences).not.toContain("AGENTS.md");
  });

  it("reports nothing to do on an already-migrated repository", async () => {
    await seed({ "docs/product.md": PRODUCT_BODY, "docs/tech.md": TECH_BODY });
    const result = await runDocsMigration(repo, { apply: false });
    expect(result.renames).toEqual([]);
    expect(result.applied).toBe(false);
  });
});

describe("runDocsMigration — apply (--force)", () => {
  it("renames both documents with content byte-identical", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY, "docs/technical-guidelines.md": TECH_BODY });
    const result = await runDocsMigration(repo, { apply: true });

    expect(result.applied).toBe(true);
    expect(existsSync(join(repo, "docs/product-context.md"))).toBe(false);
    expect(existsSync(join(repo, "docs/technical-guidelines.md"))).toBe(false);

    expect(sha256(await readFile(join(repo, "docs/product.md"), "utf-8"))).toBe(sha256(PRODUCT_BODY));
    expect(sha256(await readFile(join(repo, "docs/tech.md"), "utf-8"))).toBe(sha256(TECH_BODY));
  });

  it("backs the originals up before renaming, under .dev-tasks/backup", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY });
    const result = await runDocsMigration(repo, { apply: true });

    expect(result.backupPath).toBeDefined();
    const backed = await readFile(join(result.backupPath!, "docs/product-context.md"), "utf-8");
    expect(sha256(backed)).toBe(sha256(PRODUCT_BODY));

    const backups = await readdir(join(repo, ".dev-tasks", "backup"));
    expect(backups).toHaveLength(1);
  });

  it("refuses a rename whose target already exists, and leaves both files alone", async () => {
    // A partial migration must not silently clobber the newer file.
    await seed({
      "docs/product-context.md": PRODUCT_BODY,
      "docs/product.md": "# Different content\n",
    });
    const result = await runDocsMigration(repo, { apply: true });

    const product = result.renames.find((r) => r.from === "docs/product-context.md");
    expect(product?.skipped).toBe("target-exists");
    expect(await readFile(join(repo, "docs/product.md"), "utf-8")).toBe("# Different content\n");
    expect(existsSync(join(repo, "docs/product-context.md"))).toBe(true);
  });

  it("does nothing when there is nothing to migrate", async () => {
    await seed({ "docs/product.md": PRODUCT_BODY });
    const result = await runDocsMigration(repo, { apply: true });
    expect(result.renames).toEqual([]);
    expect(result.backupPath).toBeUndefined();
    expect(existsSync(join(repo, ".dev-tasks"))).toBe(false);
  });

  it("reports an error rather than throwing when the rename cannot be written", async () => {
    await seed({ "docs/product-context.md": PRODUCT_BODY });
    await chmod(join(repo, "docs"), 0o500); // read + execute, no write

    const result = await runDocsMigration(repo, { apply: true });
    const product = result.renames.find((r) => r.from === "docs/product-context.md");
    expect(product?.error).toBeDefined();
    expect(existsSync(join(repo, "docs/product-context.md"))).toBe(true);
  });
});
