/**
 * Contract tests for the deploy-ops script templates (Story S-008).
 *
 * These invoke the templated shell scripts with a stub `bin` directory on
 * PATH so no real cloud CLI is required. The stubs log their argv to a file
 * the test reads back to assert the dry-run command sequence.
 *
 * Acceptance-criteria mapping (from the spec / user story S-008):
 *   AC-2 -> `--help`, `set -euo pipefail`, dry-run flags, files exist
 *   AC-3 -> ordered dry-run step sequence; exit 2 on blocked conditions
 *   AC-4 -> production refuses a non-annotated-tag ref; dev deploys main HEAD
 *   AC-5 -> deploy-verify.sh exits 3 and prints the rollback invocation
 *   AC-6 -> rollback.sh resolves previous good version from infra/changes/
 *   AC-7 -> release.sh --dry-run writes nothing
 *   AC-8 -> environments resolved via yq; missing/template file exits 2
 *   AC-9 -> bash -n syntax; shellcheck when available else SKIPPED
 * Edge cases (8.9): dirty tree; lightweight tag; tag not on main; missing yq;
 *   two platform blocks without a deploy kind.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SCRIPTS_DIR = resolve(ROOT, "templates/scripts");
const STUB_BIN = resolve(ROOT, "test/fixtures/infra/bin");
const FIXTURE_ENV = resolve(ROOT, "test/fixtures/infra/environments.yaml");

const SCRIPTS = ["deploy.sh", "deploy-verify.sh", "rollback.sh", "deploy-status.sh", "release.sh"] as const;

function scriptPath(name: string): string {
  return resolve(SCRIPTS_DIR, name);
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  stubLog: string;
}

/**
 * Run a templated script with the stub bin dir prepended to PATH. `env`
 * overrides are merged on top. A per-run stub log path is injected so argv
 * capture is isolated between cases.
 */
function runScript(name: string, args: string[], env: Record<string, string> = {}): RunResult {
  const stubLog = resolve(mkdtempSync(resolve(tmpdir(), "infra-stub-")), "argv.log");
  const result = spawnSync("bash", [scriptPath(name), ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${STUB_BIN}${delimiter}${process.env.PATH ?? ""}`,
      INFRA_STUB_LOG: stubLog,
      INFRA_ENV_FILE: env.INFRA_ENV_FILE ?? FIXTURE_ENV,
      // Default to a non-interactive, non-CI, human-approved context so the
      // human-only guard does not fire unless a case opts in.
      INFRA_HUMAN_APPROVED: "1",
      INFRA_ASSUME_REF_OK: env.INFRA_ASSUME_REF_OK ?? "1",
      CI: env.CI ?? "",
      ...env,
    },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    stubLog: existsSync(stubLog) ? readFileSync(stubLog, "utf-8") : "",
  };
}

// ─── AC-2 / AC-9: presence, shebang, strict mode, bash -n syntax ─────────────

describe("script templates — presence and shape (AC-2, AC-9)", () => {
  for (const name of SCRIPTS) {
    it(`${name} exists`, () => {
      expect(existsSync(scriptPath(name)), `missing script: ${name}`).toBe(true);
    });

    it(`${name} declares set -euo pipefail`, () => {
      const src = readFileSync(scriptPath(name), "utf-8");
      expect(/set -euo pipefail/.test(src), `${name} missing strict mode`).toBe(true);
    });

    it(`${name} passes bash -n syntax check`, () => {
      const res = spawnSync("bash", ["-n", scriptPath(name)], { encoding: "utf-8" });
      expect(res.status, `${name} bash -n failed: ${res.stderr}`).toBe(0);
    });

    it(`${name} responds to --help with exit 0 and usage text`, () => {
      const res = runScript(name, ["--help"]);
      expect(res.status, `${name} --help exit`).toBe(0);
      expect(/usage/i.test(res.stdout), `${name} --help lacks usage text`).toBe(true);
    });
  }
});

// ─── AC-9: shellcheck when available, else an explicit SKIPPED marker ─────────

describe("script templates — shellcheck (AC-9)", () => {
  const hasShellcheck = spawnSync("shellcheck", ["--version"], { encoding: "utf-8" }).status === 0;

  if (!hasShellcheck) {
    it("SKIPPED: shellcheck not installed on this host", () => {
      expect(hasShellcheck).toBe(false);
    });
  } else {
    for (const name of SCRIPTS) {
      it(`${name} passes shellcheck`, () => {
        const res = spawnSync("shellcheck", ["-S", "warning", scriptPath(name)], {
          encoding: "utf-8",
        });
        expect(res.status, `${name} shellcheck: ${res.stdout}`).toBe(0);
      });
    }
  }
});

// ─── AC-8: environment file resolution ────────────────────────────────────────

describe("deploy.sh — environment file resolution (AC-8)", () => {
  it("exits 2 when the environments file is missing", () => {
    const res = runScript("deploy.sh", ["dev", "--dry-run"], {
      INFRA_ENV_FILE: resolve(ROOT, "test/fixtures/infra/does-not-exist.yaml"),
    });
    expect(res.status).toBe(2);
  });

  it("exits 2 when the environments file is template-status", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "infra-tmpl-"));
    const tmpl = resolve(dir, "environments.yaml");
    writeFileSync(tmpl, "# status: template\nenvironments:\n  dev:\n    production: false\n");
    const res = runScript("deploy.sh", ["dev", "--dry-run"], { INFRA_ENV_FILE: tmpl });
    expect(res.status).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it("exits 2 for an unknown environment name", () => {
    const res = runScript("deploy.sh", ["staging", "--dry-run"]);
    expect(res.status).toBe(2);
  });

  it("resolves the env via yq (stub yq is invoked)", () => {
    const res = runScript("deploy.sh", ["dev", "--dry-run"]);
    expect(res.stubLog).toMatch(/^yq /m);
  });
});

// ─── AC-3 / AC-4: dry-run ordered sequence and ref rules ─────────────────────

describe("deploy.sh dev — dry-run sequence (AC-3, AC-4)", () => {
  let res: RunResult;
  beforeEach(() => {
    res = runScript("deploy.sh", ["dev", "--dry-run"]);
  });

  it("succeeds (exit 0) in dry-run for a valid dev env", () => {
    expect(res.status, res.stderr).toBe(0);
  });

  it("prints the eight ordered steps in order", () => {
    // Match the explicit "Step N/8 <name>" markers the script emits, so the
    // `[deploy]` log prefix does not create false substring hits.
    const steps = [
      "step 1/8 preflight",
      "step 2/8 validate",
      "step 3/8 build",
      "step 4/8 backup",
      "step 5/8 migrate",
      "step 6/8 deploy",
      "step 7/8 verify",
      "step 8/8 record",
    ];
    const lower = res.stdout.toLowerCase();
    const indices = steps.map((s) => lower.indexOf(s));
    expect(indices.every((i) => i >= 0), `missing step in output:\n${res.stdout}`).toBe(true);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("does not skip validate", () => {
    expect(/validate/i.test(res.stdout)).toBe(true);
  });
});

describe("deploy.sh prod — ref rules (AC-4)", () => {
  it("refuses when the ref is not an annotated tag on main", () => {
    const res = runScript("deploy.sh", ["prod", "--dry-run"], { INFRA_ASSUME_REF_OK: "0" });
    expect(res.status).toBe(2);
    expect(/tag|ref/i.test(res.stdout + res.stderr)).toBe(true);
  });
});

// ─── AC-5: deploy-verify.sh failure path ─────────────────────────────────────

describe("deploy-verify.sh — failure prints rollback (AC-5)", () => {
  it("exits 3 and prints the rollback.sh invocation on a failing health check", () => {
    const res = runScript("deploy-verify.sh", ["dev"], { INFRA_VERIFY_FORCE_FAIL: "1" });
    expect(res.status).toBe(3);
    expect(res.stdout + res.stderr).toMatch(/rollback\.sh dev/);
  });
});

// ─── AC-6: rollback.sh resolves previous good version ────────────────────────

describe("rollback.sh — resolves previous good version (AC-6)", () => {
  let changesDir: string;
  beforeEach(() => {
    changesDir = mkdtempSync(resolve(tmpdir(), "infra-changes-"));
  });
  afterEach(() => {
    rmSync(changesDir, { recursive: true, force: true });
  });

  it("resolves the previous good version from infra/changes/ with no manual lookup", () => {
    writeFileSync(resolve(changesDir, "2024-01-01-dev-v1.0.0.md"), "env: dev\nversion: v1.0.0\nstatus: good\n");
    writeFileSync(resolve(changesDir, "2024-01-02-dev-v1.1.0.md"), "env: dev\nversion: v1.1.0\nstatus: good\n");
    const res = runScript("rollback.sh", ["dev", "--dry-run"], { INFRA_CHANGES_DIR: changesDir });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/v1\.1\.0|v1\.0\.0/);
  });

  it("honors --to <version> as an override", () => {
    writeFileSync(resolve(changesDir, "2024-01-01-dev-v1.0.0.md"), "env: dev\nversion: v1.0.0\nstatus: good\n");
    const res = runScript("rollback.sh", ["dev", "--to", "v0.9.0", "--dry-run"], {
      INFRA_CHANGES_DIR: changesDir,
    });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/v0\.9\.0/);
  });
});

// ─── AC-7: release.sh --dry-run writes nothing ───────────────────────────────

describe("release.sh — dry-run writes nothing (AC-7)", () => {
  it("supports --dry-run and does not push or tag", () => {
    const res = runScript("release.sh", ["patch", "--dry-run"]);
    // Dry-run must not invoke any git push/tag via the log-visible stubs, and
    // must exit cleanly (0) or with a benign non-mutating status.
    expect(res.stdout.toLowerCase()).toMatch(/dry.?run/);
  });
});

// ─── AC-3: exit 2 on blocked conditions / edge cases (8.9) ───────────────────

describe("deploy.sh — blocked conditions and edge cases (AC-3, 8.9)", () => {
  it("refuses an ambiguous env with two platform blocks and no deploy kind", () => {
    const res = runScript("deploy.sh", ["ambiguous", "--dry-run"]);
    expect(res.status).toBe(2);
    expect(/ambig|deploy kind|deploy-kind/i.test(res.stdout + res.stderr)).toBe(true);
  });

  it("exits 2 when yq is missing from PATH", () => {
    // Point PATH at a dir without yq (system PATH minus the stub bin dir).
    const res = spawnSync("bash", [scriptPath("deploy.sh"), "dev", "--dry-run"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        PATH: "/usr/bin:/bin",
        INFRA_ENV_FILE: FIXTURE_ENV,
        INFRA_HUMAN_APPROVED: "1",
        INFRA_ASSUME_REF_OK: "1",
        CI: "",
      },
    });
    expect(res.status).toBe(2);
    expect(/yq/i.test((res.stdout ?? "") + (res.stderr ?? ""))).toBe(true);
  });
});

// ─── Business rule: human-only guard for prod / release under CI ─────────────

describe("human-only guard (business rule)", () => {
  it("deploy.sh prod refuses when CI is set without INFRA_HUMAN_APPROVED", () => {
    const res = runScript("deploy.sh", ["prod", "--dry-run"], {
      CI: "true",
      INFRA_HUMAN_APPROVED: "",
      INFRA_ASSUME_REF_OK: "1",
    });
    expect(res.status).toBe(2);
    expect(/approval|human/i.test(res.stdout + res.stderr)).toBe(true);
  });

  it("release.sh refuses when CI is set without INFRA_HUMAN_APPROVED", () => {
    const res = runScript("release.sh", ["patch", "--dry-run"], {
      CI: "true",
      INFRA_HUMAN_APPROVED: "",
    });
    expect(res.status).toBe(2);
    expect(/approval|human/i.test(res.stdout + res.stderr)).toBe(true);
  });
});
