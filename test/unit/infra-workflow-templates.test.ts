/**
 * Contract checks for the GitHub Actions workflow templates (Story S-009).
 *
 * Covers:
 *   AC-1  deploy-dev.yml (push main → deploy.sh), deploy-prod.yml (exact-semver
 *         tag, environment: production → deploy.sh prod), rollback.yml
 *         (workflow_dispatch with env input → rollback.sh)
 *   AC-2  tools set up via OIDC and version-pinned actions; NO inline
 *         aws/flyctl/supabase deploy calls — the workflows invoke the
 *         templates/scripts/* scripts only
 *   AC-6  this passing test itself; plus this repo's own release workflows
 *         trigger on the exact-semver filter
 *
 * The templates live outside the JS prettier glob and are parsed here with the
 * repo's existing YAML library (`yaml`).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(__dirname, "../..");

const DEPLOY_DEV = "templates/workflows/deploy-dev.yml";
const DEPLOY_PROD = "templates/workflows/deploy-prod.yml";
const ROLLBACK = "templates/workflows/rollback.yml";
const WORKFLOW_TEMPLATES = [DEPLOY_DEV, DEPLOY_PROD, ROLLBACK] as const;

/** This repo's own release workflows — must fire on exact semver only. */
const RELEASE_WORKFLOWS = [
  ".github/workflows/publish-npm.yml",
  ".github/workflows/release-bundle.yml",
] as const;

const EXACT_SEMVER = "v[0-9]+.[0-9]+.[0-9]+";

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

/**
 * YAML parses `on:` as the boolean `true` (the "Norway problem") unless quoted.
 * Resolve the trigger block whether it lands under `on` or `true`.
 */
function triggers(doc: Record<string, unknown>): Record<string, unknown> {
  const on = (doc.on ?? (doc as Record<string, unknown>).true) as
    | Record<string, unknown>
    | undefined;
  return on ?? {};
}

describe("infra workflow templates — files present", () => {
  for (const relPath of WORKFLOW_TEMPLATES) {
    it(`ships ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing workflow template: ${relPath}`).toBe(
        true,
      );
    });
  }
});

describe("infra workflow templates — parse as YAML", () => {
  for (const relPath of WORKFLOW_TEMPLATES) {
    it(`${relPath} parses as a YAML mapping`, () => {
      const doc = parseYaml(read(relPath)) as Record<string, unknown>;
      expect(doc, `${relPath} did not parse to an object`).toBeTypeOf("object");
      expect(doc).not.toBeNull();
      expect(doc.jobs, `${relPath} has no jobs block`).toBeDefined();
    });
  }
});

describe("infra workflow templates — AC-1 triggers", () => {
  it("deploy-dev.yml triggers on push to main", () => {
    const doc = parseYaml(read(DEPLOY_DEV)) as Record<string, unknown>;
    const push = triggers(doc).push as { branches?: unknown } | undefined;
    expect(push, "deploy-dev.yml has no push trigger").toBeDefined();
    expect(push?.branches, "deploy-dev.yml push trigger has no branches").toContain("main");
  });

  it("deploy-prod.yml triggers on exact-semver tags", () => {
    const doc = parseYaml(read(DEPLOY_PROD)) as Record<string, unknown>;
    const push = triggers(doc).push as { tags?: unknown } | undefined;
    expect(push, "deploy-prod.yml has no push trigger").toBeDefined();
    expect(push?.tags, "deploy-prod.yml push trigger has no tags").toContain(EXACT_SEMVER);
  });

  it("deploy-prod.yml does not trigger on push to a branch", () => {
    const doc = parseYaml(read(DEPLOY_PROD)) as Record<string, unknown>;
    const push = triggers(doc).push as { branches?: unknown } | undefined;
    expect(push?.branches, "deploy-prod.yml must be tag-only, not branch-triggered").toBeUndefined();
  });

  it("rollback.yml triggers on workflow_dispatch with an environment input", () => {
    const doc = parseYaml(read(ROLLBACK)) as Record<string, unknown>;
    const dispatch = triggers(doc).workflow_dispatch as
      | { inputs?: Record<string, unknown> }
      | undefined;
    expect(dispatch, "rollback.yml has no workflow_dispatch trigger").toBeDefined();
    const inputs = dispatch?.inputs ?? {};
    const inputKeys = Object.keys(inputs).map((k) => k.toLowerCase());
    expect(
      inputKeys.some((k) => k.includes("environment") || k === "env"),
      "rollback.yml workflow_dispatch has no environment input",
    ).toBe(true);
  });
});

describe("infra workflow templates — AC-1 environment protection", () => {
  it("deploy-prod.yml declares environment: production on its deploy job", () => {
    const doc = parseYaml(read(DEPLOY_PROD)) as { jobs?: Record<string, { environment?: unknown }> };
    const jobs = doc.jobs ?? {};
    const environments = Object.values(jobs).map((j) => {
      const env = j.environment;
      if (typeof env === "string") return env;
      if (env && typeof env === "object" && "name" in env) {
        return (env as { name?: unknown }).name;
      }
      return undefined;
    });
    expect(
      environments,
      "deploy-prod.yml has no job with environment: production",
    ).toContain("production");
  });

  it("deploy-dev.yml does not gate its job behind the production environment", () => {
    const doc = parseYaml(read(DEPLOY_DEV)) as { jobs?: Record<string, { environment?: unknown }> };
    const jobs = doc.jobs ?? {};
    for (const job of Object.values(jobs)) {
      const env = typeof job.environment === "string" ? job.environment : undefined;
      expect(env, "deploy-dev.yml must not use the production environment").not.toBe("production");
    }
  });
});

describe("infra workflow templates — AC-1 script invocation", () => {
  it("deploy-dev.yml invokes deploy.sh", () => {
    expect(read(DEPLOY_DEV)).toMatch(/deploy\.sh\b/);
  });

  it("deploy-prod.yml invokes deploy.sh prod", () => {
    expect(read(DEPLOY_PROD)).toMatch(/deploy\.sh\s+prod\b/);
  });

  it("rollback.yml invokes rollback.sh", () => {
    expect(read(ROLLBACK)).toMatch(/rollback\.sh\b/);
  });
});

describe("infra workflow templates — AC-2 tool setup and no inline deploy calls", () => {
  // Deploy verbs that would indicate inline platform logic rather than a script call.
  const INLINE_DEPLOY_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "inline flyctl/fly deploy", pattern: /\b(flyctl|fly)\s+deploy\b/ },
    { label: "inline supabase db push", pattern: /\bsupabase\s+db\s+push\b/ },
    { label: "inline supabase functions deploy", pattern: /\bsupabase\s+functions\s+deploy\b/ },
    { label: "inline aws ecs update-service", pattern: /\baws\s+ecs\s+update-service\b/ },
    { label: "inline aws deploy", pattern: /\baws\s+deploy\b/ },
  ];

  for (const relPath of WORKFLOW_TEMPLATES) {
    for (const { label, pattern } of INLINE_DEPLOY_PATTERNS) {
      it(`${relPath} contains no ${label}`, () => {
        expect(pattern.test(read(relPath)), `${relPath} contains an ${label}`).toBe(false);
      });
    }
  }

  it("deploy-prod.yml configures AWS credentials via OIDC (id-token permission)", () => {
    const raw = read(DEPLOY_PROD);
    const doc = parseYaml(raw) as { permissions?: Record<string, unknown> };
    expect(
      doc.permissions?.["id-token"],
      "deploy-prod.yml must request id-token: write for OIDC",
    ).toBe("write");
    expect(raw).toMatch(/aws-actions\/configure-aws-credentials@/);
  });

  it("every action reference in the templates is version-pinned", () => {
    for (const relPath of WORKFLOW_TEMPLATES) {
      const raw = read(relPath);
      const uses = [...raw.matchAll(/uses:\s*([^\s#]+)/g)].map((m) => m[1]);
      for (const ref of uses) {
        expect(
          /@(v?\d[\w.\-]*|[0-9a-f]{40})$/.test(ref),
          `${relPath}: action "${ref}" is not version-pinned`,
        ).toBe(true);
      }
    }
  });
});

describe("infra workflow templates — AC-6 this repo's release workflows use exact semver", () => {
  for (const relPath of RELEASE_WORKFLOWS) {
    it(`${relPath} triggers only on the exact-semver tag filter`, () => {
      const doc = parseYaml(read(relPath)) as Record<string, unknown>;
      const push = triggers(doc).push as { tags?: unknown } | undefined;
      expect(push, `${relPath} has no push trigger`).toBeDefined();
      expect(
        push?.tags,
        `${relPath} does not filter tags on exact semver ${EXACT_SEMVER}`,
      ).toContain(EXACT_SEMVER);
    });
  }
});
