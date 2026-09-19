/**
 * Guards the runbook set (S-003; PRD FR-47, FR-48, AC-25).
 *
 * Four things are asserted here, and the fourth is the one that matters
 * most: every file under `templates/scripts/`, `templates/workflows/`,
 * and `.github/workflows/` must be named by some runbook's `related`
 * field. That is reverse coverage — it fails when a new script lands
 * without a runbook, which is exactly the drift FR-47 exists to stop.
 *
 * Frontmatter is hand-parsed over five fixed keys (D-49) rather than
 * pulling `yaml` into `dependencies` for a format this rigid.
 *
 * NOTE ON `related` PATHS: they are checked for existence. A runbook
 * that points at a file which no longer exists is worse than no runbook
 * — the reader follows it and finds nothing. When a script is retired,
 * its runbook is retired with it (SIMPLICITY.md A10), not left dangling.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const RUNBOOK_DIR = join(ROOT, "docs/runbooks");
const TEMPLATE_DIR = join(ROOT, "templates/runbooks");

/**
 * The initial set: FR-47's nine, plus `runbook-deploy-service`. Those
 * nine leave five deploy-surface files uncovered, which fails PRD AC-25
 * — the tenth closes the gap (recorded as a decision in S-003).
 */
const EXPECTED_RUNBOOKS = [
  "runbook-configure-branch-protection",
  "runbook-deploy-service",
  "runbook-install-dev-tasks",
  "runbook-migrate-foundation-docs",
  "runbook-release-npm",
  "runbook-retire-dt",
  "runbook-rollback-deploy",
  "runbook-setup-simplicity-tooling",
  "runbook-setup-supabase-local",
  "runbook-troubleshoot-hooks",
];

/** FR-48's five fixed body headings, in order. */
const REQUIRED_HEADINGS = [
  "## Preconditions",
  "## Steps",
  "## Verification",
  "## Rollback",
  "## Escalation",
];

const REQUIRED_KEYS = ["name", "trigger", "owner", "last_verified", "related"];

/** Directories whose every file must be named by some runbook (AC-25). */
const COVERED_DIRS = ["templates/scripts", "templates/workflows", ".github/workflows"];

interface Frontmatter {
  values: Record<string, string>;
  related: string[];
}

/**
 * Parse the five fixed keys out of a `---`-delimited frontmatter block.
 * `related` is a bracketed inline list; everything else is a scalar.
 */
function parseFrontmatter(content: string): Frontmatter | null {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return null;

  const values: Record<string, string> = {};
  for (const line of content.slice(4, end).split("\n")) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }

  const rawRelated = values["related"] ?? "";
  const related = rawRelated
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => s.length > 0);

  return { values, related };
}

function runbookFiles(): string[] {
  return readdirSync(RUNBOOK_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
}

function readRunbook(slug: string): string {
  return readFileSync(join(RUNBOOK_DIR, `${slug}.md`), "utf-8");
}

describe("runbook set (FR-47, FR-48, PRD AC-25)", () => {
  it("carries exactly the initial set, and nothing undeclared", () => {
    const onDisk = runbookFiles().map((f) => f.replace(/\.md$/, ""));
    expect(onDisk).toEqual(EXPECTED_RUNBOOKS);
  });

  describe.each(EXPECTED_RUNBOOKS)("%s", (slug) => {
    it("has frontmatter with all five keys, non-empty", () => {
      const parsed = parseFrontmatter(readRunbook(slug));
      expect(parsed, `${slug}.md has no parseable frontmatter block`).not.toBeNull();
      for (const key of REQUIRED_KEYS) {
        expect(parsed!.values[key], `${slug}.md is missing frontmatter key '${key}'`).toBeTruthy();
      }
    });

    it("names itself in frontmatter, matching its filename", () => {
      const parsed = parseFrontmatter(readRunbook(slug))!;
      expect(parsed.values["name"]).toBe(slug);
    });

    it("has an ISO last_verified date", () => {
      const parsed = parseFrontmatter(readRunbook(slug))!;
      expect(parsed.values["last_verified"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("has the five fixed headings, in order", () => {
      const content = readRunbook(slug);
      let cursor = -1;
      for (const heading of REQUIRED_HEADINGS) {
        const at = content.indexOf(`\n${heading}\n`);
        expect(at, `${slug}.md is missing or misorders '${heading}'`).toBeGreaterThan(cursor);
        cursor = at;
      }
    });

    it("has no empty section between its headings", () => {
      // A heading with nothing under it passes a naive presence check and
      // teaches the reader nothing.
      const content = readRunbook(slug);
      for (let i = 0; i < REQUIRED_HEADINGS.length; i++) {
        const start = content.indexOf(REQUIRED_HEADINGS[i]) + REQUIRED_HEADINGS[i].length;
        const next = REQUIRED_HEADINGS[i + 1];
        const end = next ? content.indexOf(next) : content.length;
        const body = content.slice(start, end).trim();
        expect(
          body.length,
          `${slug}.md has an empty '${REQUIRED_HEADINGS[i]}' section`,
        ).toBeGreaterThan(20);
      }
    });

    it("names only `related` paths that exist", () => {
      const parsed = parseFrontmatter(readRunbook(slug))!;
      for (const rel of parsed.related) {
        expect(existsSync(join(ROOT, rel)), `${slug}.md names a missing path: ${rel}`).toBe(true);
      }
    });
  });

  it("covers every script and workflow in some runbook's `related` (PRD AC-25)", () => {
    const covered = new Set<string>();
    for (const slug of EXPECTED_RUNBOOKS) {
      for (const rel of parseFrontmatter(readRunbook(slug))!.related) {
        covered.add(rel);
      }
    }

    const uncovered: string[] = [];
    for (const dir of COVERED_DIRS) {
      for (const file of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${file}`;
        if (!covered.has(rel)) uncovered.push(rel);
      }
    }

    expect(
      uncovered,
      `Not named by any runbook's 'related' field:\n  ${uncovered.join("\n  ")}`,
    ).toEqual([]);
  });

  it("distinguishes the release template from this repository's own release script", () => {
    // The near-miss AC-5 calls out: templates/scripts/release.sh is the
    // consumer-facing template and the AC-25 surface; scripts/release.sh
    // is this repo's own. Naming the wrong one leaves a file uncovered
    // while looking complete.
    const related = parseFrontmatter(readRunbook("runbook-release-npm"))!.related;
    expect(related).toContain("templates/scripts/release.sh");
    expect(related).not.toContain("scripts/release.sh");
  });

  it("lists exactly the runbooks on disk in the index (AC-6)", () => {
    const index = readFileSync(join(RUNBOOK_DIR, "README.md"), "utf-8");
    for (const slug of EXPECTED_RUNBOOKS) {
      expect(index, `index does not link ${slug}`).toContain(`${slug}.md`);
    }
    // And nothing the index links is absent from disk.
    for (const linked of index.match(/runbook-[a-z0-9-]+\.md/g) ?? []) {
      expect(existsSync(join(RUNBOOK_DIR, linked)), `index links missing ${linked}`).toBe(true);
    }
  });

  it("gives the index a trigger, owner, and last-verified column (AC-6)", () => {
    const index = readFileSync(join(RUNBOOK_DIR, "README.md"), "utf-8");
    expect(index).toMatch(/\|\s*Runbook\s*\|/i);
    expect(index).toMatch(/\|\s*Trigger\s*\|/i);
    expect(index).toMatch(/\|\s*Owner\s*\|/i);
    expect(index).toMatch(/\|\s*Last verified\s*\|/i);
  });

  it("ships a template that satisfies the same contract", () => {
    const template = readFileSync(join(TEMPLATE_DIR, "runbook-template.md"), "utf-8");
    const parsed = parseFrontmatter(template);
    expect(parsed, "the runbook template has no parseable frontmatter").not.toBeNull();
    for (const key of REQUIRED_KEYS) {
      expect(parsed!.values, `the template omits frontmatter key '${key}'`).toHaveProperty(key);
    }
    for (const heading of REQUIRED_HEADINGS) {
      expect(template, `the template omits '${heading}'`).toContain(heading);
    }
  });

  it("ships an index template for the consumer's own runbooks", () => {
    expect(existsSync(join(TEMPLATE_DIR, "README.md"))).toBe(true);
  });

  it("links docs/runbooks from the docs index (AC-7)", () => {
    const docsIndex = readFileSync(join(ROOT, "docs/README.md"), "utf-8");
    expect(docsIndex).toMatch(/runbooks/i);
  });

  describe("the parser itself", () => {
    it("rejects a file with no frontmatter block", () => {
      expect(parseFrontmatter("# Just a heading\n")).toBeNull();
    });

    it("rejects an unterminated frontmatter block", () => {
      expect(parseFrontmatter("---\nname: x\n")).toBeNull();
    });

    it("splits a bracketed related list and strips quotes", () => {
      const parsed = parseFrontmatter(
        '---\nname: r\nrelated: ["a/b.sh", "c/d.yml"]\n---\n\nbody\n',
      );
      expect(parsed!.related).toEqual(["a/b.sh", "c/d.yml"]);
    });

    it("reads an empty related list as no coverage, not as a wildcard", () => {
      const parsed = parseFrontmatter("---\nname: r\nrelated: []\n---\n\nbody\n");
      expect(parsed!.related).toEqual([]);
    });
  });
});
