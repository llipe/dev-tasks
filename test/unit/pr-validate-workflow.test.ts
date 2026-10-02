/**
 * Pins the shape of the PR-triggered `validate` workflow (#248).
 *
 * Until this workflow existed, `validate` ran only inside the npm publish
 * job — i.e. after a release tag, long after the change merged. These
 * assertions guard the properties that make the check worth having:
 *
 * - it fires on every pull request, whatever the base branch (AC-1) — an
 *   integration-branch PR is where a batch is assembled, so a `branches:`
 *   filter limited to `main` would skip exactly the PRs that need it;
 * - it runs the whole `validate` script, not a hand-picked subset that can
 *   drift from what `package.json` calls the gate (AC-2);
 * - it installs from the lockfile, so CI tests what is committed;
 * - it asks for read-only repository access.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(import.meta.dirname, "../..");
const WORKFLOW = resolve(ROOT, ".github/workflows/validate.yml");

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Job {
  steps?: Step[];
}

type Doc = Record<string, unknown> & { jobs?: Record<string, Job> };

function load(): Doc {
  return parseYaml(readFileSync(WORKFLOW, "utf-8")) as Doc;
}

/** YAML 1.1 readers turn a bare `on:` into `true`; accept either key. */
function triggers(doc: Doc): Record<string, unknown> {
  return ((doc.on ?? doc.true) as Record<string, unknown> | undefined) ?? {};
}

function onlyJob(doc: Doc): Job {
  const jobs = Object.values(doc.jobs ?? {});
  expect(jobs.length, "validate.yml should define a single job").toBe(1);
  return jobs[0];
}

describe(".github/workflows/validate.yml (#248)", () => {
  it("exists", () => {
    expect(existsSync(WORKFLOW), "missing .github/workflows/validate.yml").toBe(true);
  });

  it("triggers on pull_request with no branch filter (AC-1)", () => {
    const on = triggers(load());
    expect(Object.keys(on)).toContain("pull_request");
    const pr = on.pull_request as Record<string, unknown> | null | undefined;
    // `pull_request:` with no body parses as null — that is the unfiltered form.
    if (pr) {
      expect(pr, "a branch filter would skip PRs into integration branches").not.toHaveProperty(
        "branches",
      );
      expect(pr).not.toHaveProperty("branches-ignore");
    }
  });

  it("requests read-only repository contents", () => {
    expect(load().permissions).toEqual({ contents: "read" });
  });

  it("cancels superseded runs for the same pull request", () => {
    const concurrency = load().concurrency as Record<string, unknown> | undefined;
    expect(concurrency, "no concurrency group").toBeDefined();
    expect(String(concurrency!.group)).toMatch(/pull_request\.number|github\.ref/);
    expect(concurrency!["cancel-in-progress"]).toBe(true);
  });

  it("installs with pnpm on Node 24, from the frozen lockfile", () => {
    const steps = onlyJob(load()).steps ?? [];
    expect(steps.some((s) => s.uses?.startsWith("actions/checkout@"))).toBe(true);
    expect(steps.some((s) => s.uses === "pnpm/action-setup@v4")).toBe(true);
    const node = steps.find((s) => s.uses?.startsWith("actions/setup-node@"));
    expect(node, "no actions/setup-node step").toBeDefined();
    expect(String(node!.with?.["node-version"])).toBe("24");
    expect(node!.with?.cache).toBe("pnpm");
    expect(steps.some((s) => s.run?.trim() === "pnpm install --frozen-lockfile")).toBe(true);
  });

  it("runs the whole validate script, last (AC-2)", () => {
    const steps = onlyJob(load()).steps ?? [];
    const runs = steps.filter((s) => s.run).map((s) => s.run!.trim());
    expect(runs.at(-1)).toBe("pnpm run validate");
  });

  it("keeps coverage out of the PR gate", () => {
    const raw = readFileSync(WORKFLOW, "utf-8");
    expect(raw).not.toMatch(/coverage/);
  });

  it("validate still covers the four sub-gates the runbook documents (AC-2)", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      scripts: Record<string, string>;
    };
    for (const gate of ["typecheck", "lint", "format:check", "test"]) {
      expect(pkg.scripts.validate).toContain(`pnpm run ${gate}`);
    }
  });
});
