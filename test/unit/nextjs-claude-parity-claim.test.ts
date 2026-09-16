/**
 * CP-04 (workstream/test-plan-claude-runtime-parity.md, Task 4.0, #172).
 *
 * `CLAUDE.md` and `CLAUDE.md.template` used to claim that the Next.js/React
 * conventions instruction (`nextjs-pages-components`) is "preserved as a
 * nested `CLAUDE.md` inside each React app's root directory" automatically.
 * No code in `core/distribution/` implements this — the decision (recorded
 * on issue #172) is to withdraw the false claim rather than build the
 * feature. This scan is resolution-agnostic: it fails if any file still
 * asserts automatic nested-`CLAUDE.md` scaffolding, and it fails on a
 * half-updated pair (one file corrected, its sibling left stale).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

/**
 * The withdrawn false claim: automatic nested-CLAUDE.md scaffolding. Matched
 * with `g` so every occurrence in a file can be checked individually — a
 * correction that *negates* the claim (e.g. "no code path creates a nested
 * `CLAUDE.md` automatically") must not itself be flagged.
 */
const FALSE_CLAIM_VERB_PATTERN =
  /(preserved as|scaffold(ed|s|ing)?|generat(ed|es|ing)|creat(ed|es|ing)) a nested `?CLAUDE\.md`?/gi;

/** Negation words that, when present in the ~60 chars preceding a match,
 * mean the sentence is correcting the claim, not making it. */
const NEGATION_PATTERN = /\b(no|not|never|isn't|doesn't|does not|no longer|there is no)\b/i;

/** True if `content` contains an *affirmative* (non-negated) instance of the
 * withdrawn false claim. */
function claimsAutomaticScaffolding(content: string): boolean {
  for (const match of content.matchAll(FALSE_CLAIM_VERB_PATTERN)) {
    const start = Math.max(0, (match.index ?? 0) - 60);
    const precedingContext = content.slice(start, match.index ?? 0);
    if (!NEGATION_PATTERN.test(precedingContext)) {
      return true;
    }
  }
  return false;
}

/** Files that must state the withdrawal explicitly: no automatic Claude
 * delivery mechanism, plus a one-line manual step for consumers. */
const DOMAIN_CONVENTIONS_FILES = ["CLAUDE.md", "CLAUDE.md.template"] as const;

const NO_AUTOMATIC_DELIVERY_PATTERN = /no automatic (claude )?deliver(y|ance) mechanism/i;
const MANUAL_STEP_PATTERN = /copy(ing)? (those |these |the )?conventions into/i;

function exists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

// Every text/doc file under these roots is in scope for the repo-wide scan.
const SCAN_ROOTS = ["core", "adapters", "templates", ".claude", ".github", ".kiro"] as const;
const SCAN_EXTENSIONS = [".md", ".ts", ".template"];

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else if (SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe("CP-04 — Next.js conventions parity claim (issue #172)", () => {
  describe("Domain-Specific Conventions section states the withdrawal", () => {
    for (const relativePath of DOMAIN_CONVENTIONS_FILES) {
      it(`${relativePath} exists`, () => {
        expect(exists(relativePath), `missing file: ${relativePath}`).toBe(true);
      });

      it(`${relativePath} does not claim automatic nested-CLAUDE.md scaffolding`, () => {
        expect(
          claimsAutomaticScaffolding(read(relativePath)),
          `${relativePath} still claims a Claude delivery mechanism that does not exist`,
        ).toBe(false);
      });

      it(`${relativePath} states there is no automatic Claude delivery mechanism`, () => {
        expect(
          NO_AUTOMATIC_DELIVERY_PATTERN.test(read(relativePath)),
          `${relativePath} does not state that there is no automatic Claude delivery mechanism`,
        ).toBe(true);
      });

      it(`${relativePath} gives consumers the one-line manual step`, () => {
        expect(
          MANUAL_STEP_PATTERN.test(read(relativePath)),
          `${relativePath} does not give consumers a manual step to copy the conventions`,
        ).toBe(true);
      });
    }
  });

  describe("AGENTS.md Instructions table notes the Claude gap", () => {
    it("AGENTS.md does not claim automatic nested-CLAUDE.md scaffolding", () => {
      expect(
        claimsAutomaticScaffolding(read("AGENTS.md")),
        "AGENTS.md still claims a Claude delivery mechanism that does not exist",
      ).toBe(false);
    });

    it("AGENTS.md notes the Claude gap for nextjs-pages-components", () => {
      const content = read("AGENTS.md");
      expect(
        /nextjs-pages-components/.test(content),
        "AGENTS.md no longer references nextjs-pages-components",
      ).toBe(true);
      expect(
        NO_AUTOMATIC_DELIVERY_PATTERN.test(content) ||
          /no claude equivalent|claude gap/i.test(content),
        "AGENTS.md does not note the Claude gap for nextjs-pages-components",
      ).toBe(true);
    });
  });

  describe("Repo-wide scan: no other file repeats the false claim", () => {
    const candidates = SCAN_ROOTS.flatMap((root) => listFilesRecursive(resolve(ROOT, root)));

    it("scanned at least one candidate file", () => {
      expect(candidates.length).toBeGreaterThan(0);
    });

    for (const fullPath of candidates) {
      const relativePath = fullPath.slice(ROOT.length + 1);
      it(`${relativePath} does not claim automatic nested-CLAUDE.md scaffolding`, () => {
        const content = readFileSync(fullPath, "utf8");
        expect(
          claimsAutomaticScaffolding(content),
          `${relativePath} claims a Claude delivery mechanism that does not exist`,
        ).toBe(false);
      });
    }
  });

  it("core/distribution has no Next.js-app-root detection or nested-CLAUDE.md write path", () => {
    // Confirms the withdraw decision is consistent with the code: no scaffold
    // logic exists, so the docs must not claim it does.
    const installPath = resolve(ROOT, "core/distribution/install.ts");
    if (!exists("core/distribution/install.ts")) return;
    const content = readFileSync(installPath, "utf8");
    expect(
      /nextjs|next\.js/i.test(content),
      "core/distribution/install.ts unexpectedly references Next.js — re-check the withdraw decision",
    ).toBe(false);
  });
});
