/**
 * Security-negative tests for the infra-engineer redaction pattern set.
 *
 * Covers Story S-005 AC-1 through AC-4. The pattern file
 * `templates/infra/redaction-patterns.txt` is applied to fixture lines with
 * `sed -E -f`; every synthetic secret MUST be rewritten to `[REDACTED:<category>]`
 * and benign lines MUST pass through untouched. The same set is used to scan
 * every shipped template, the four agent files, and the four skills for
 * fixture-shaped secret values, of which there must be none.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PATTERNS = resolve(ROOT, "templates/infra/redaction-patterns.txt");
const SECRETS = resolve(ROOT, "test/fixtures/infra/redaction/secrets.txt");
const BENIGN = resolve(ROOT, "test/fixtures/infra/redaction/benign.txt");

/** Apply the redaction set to a single line, returning the redacted result. */
function redact(line: string): string {
  return execFileSync("sed", ["-E", "-f", PATTERNS], { input: line, encoding: "utf-8" }).replace(
    /\n$/,
    "",
  );
}

/** The categories each secret fixture line must resolve to, in file order. */
const EXPECTED_CATEGORIES: readonly string[] = [
  "aws-access-key-id",
  "aws-secret-key",
  "sb-secret-key",
  "sb-publishable-key",
  "jwt",
  "fly-token",
  "github-token",
  "bearer",
  "postgres-url",
  "password",
  "email",
];

/** Raw secret substrings that must not survive redaction. */
const RAW_SECRET_FRAGMENTS: readonly string[] = [
  "AKIAIOSFODNN7EXAMPLE",
  "wJalrXUtnFEMIbKb7MDENGbPxRfiCYEXAMPLEKEY1",
  "sb_secret_abcdefghijklmnopqrstuvwxyz0123456789ABCD",
  "sb_publishable_abcdefghijklmnopqrstuvwxyz01234567",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dc19a5d8f3b2c1e0a9876543210fedcba0123456789abcd",
  "fo1_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
  "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
  "s3cr3tp4ss",
  "hunter2loginsecret",
  "alice.operator@example.com",
];

function readLines(path: string): string[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
}

describe("redaction pattern set — presence", () => {
  it("ships templates/infra/redaction-patterns.txt", () => {
    expect(existsSync(PATTERNS), "missing redaction pattern set").toBe(true);
  });
  it("ships the fixtures", () => {
    expect(existsSync(SECRETS)).toBe(true);
    expect(existsSync(BENIGN)).toBe(true);
  });
});

describe("redaction pattern set — AC-2/AC-3: every secret line is redacted", () => {
  const lines = readLines(SECRETS);

  it("has one expected category per secret fixture line", () => {
    expect(lines.length).toBe(EXPECTED_CATEGORIES.length);
  });

  lines.forEach((line, i) => {
    const category = EXPECTED_CATEGORIES[i];
    it(`redacts line ${i + 1} to [REDACTED:${category}]`, () => {
      const out = redact(line);
      expect(out, `line "${line}" did not produce [REDACTED:${category}]`).toContain(
        `[REDACTED:${category}]`,
      );
    });
  });

  it("leaves no raw secret fragment after redaction", () => {
    const out = redact(readFileSync(SECRETS, "utf-8"));
    for (const fragment of RAW_SECRET_FRAGMENTS) {
      expect(out.includes(fragment), `raw secret survived redaction: ${fragment}`).toBe(false);
    }
  });
});

describe("redaction pattern set — benign lines untouched", () => {
  const lines = readLines(BENIGN);
  lines.forEach((line, i) => {
    it(`leaves benign line ${i + 1} unchanged`, () => {
      expect(redact(line)).toBe(line);
    });
  });
});

describe("redaction pattern set — edge cases", () => {
  it("redacts two secrets on one line", () => {
    const out = redact(
      "key AKIAIOSFODNN7EXAMPLE and token ghp_abcdefghijklmnopqrstuvwxyz0123456789 here",
    );
    expect(out).toContain("[REDACTED:aws-access-key-id]");
    expect(out).toContain("[REDACTED:github-token]");
  });

  it("redacts a secret inside JSON quotes", () => {
    const out = redact('{"key":"AKIAIOSFODNN7EXAMPLE"}');
    expect(out).toContain("[REDACTED:aws-access-key-id]");
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts an uppercase POSTGRESQL:// scheme with credentials", () => {
    const out = redact("POSTGRESQL://appuser:s3cr3tp4ss@db.example.com:5432/appdb");
    expect(out).toContain("[REDACTED:postgres-url]");
    expect(out).not.toContain("s3cr3tp4ss");
  });
});

// ─── AC-4: repository scan for fixture-shaped values ─────────────────────────

/** Files and trees that MUST NOT contain a fixture-shaped secret value. */
function scanTargets(): string[] {
  const targets: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else targets.push(full);
    }
  };
  // Every file under templates/ (except the fixtures, which live under test/).
  walk(resolve(ROOT, "templates"));
  // The four agent files.
  targets.push(
    resolve(ROOT, ".github/agents/infra-engineer.agent.md"),
    resolve(ROOT, ".claude/commands/infra-engineer.md"),
    resolve(ROOT, ".kiro/agents/infra-engineer.md"),
    resolve(ROOT, ".github/prompts/infra-engineer.prompt.md"),
  );
  // The four skills across the canonical tree.
  for (const skill of ["aws-ops", "fly-ops", "supabase-ops", "deploy-ops"]) {
    targets.push(resolve(ROOT, `.github/skills/${skill}/SKILL.md`));
  }
  return targets.filter((t) => existsSync(t));
}

describe("redaction pattern set — AC-4: no fixture-shaped secrets in shipped files", () => {
  const targets = scanTargets();

  for (const fragment of RAW_SECRET_FRAGMENTS) {
    it(`no shipped file contains "${fragment}"`, () => {
      const offenders = targets.filter((t) => readFileSync(t, "utf-8").includes(fragment));
      expect(
        offenders,
        `fixture-shaped secret "${fragment}" found in: ${offenders.join(", ")}`,
      ).toEqual([]);
    });
  }
});
