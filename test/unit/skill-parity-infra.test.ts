/**
 * Structural and behavioral parity checks for the infra-engineer platform skills.
 *
 * Covers Story S-002 (aws-ops), S-003 (fly-ops), S-004 (supabase-ops), and
 * S-008 (deploy-ops). Each skill ships in all three platform trees with an
 * identical body after frontmatter, and each declares the fields the agent
 * contract relies on (tool floor, auth probe, backup, revert source, log
 * table, sweep categories, and skill-specific rules).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

const TREES = [".github/skills", ".claude/skills", ".kiro/skills"] as const;

interface SkillSpec {
  /** Directory name of the skill, e.g. `aws-ops`. */
  name: string;
  /** Normative statements that MUST appear in the shared body. */
  statements: ReadonlyArray<{ label: string; pattern: RegExp }>;
}

const SKILLS: readonly SkillSpec[] = [
  {
    name: "aws-ops",
    statements: [
      { label: "tool floor", pattern: /floor/i },
      { label: "aws tool declaration", pattern: /\baws\b/ },
      { label: "auth probe sts", pattern: /aws sts get-caller-identity/ },
      { label: "version floor 2.x", pattern: /2\.\d|2\.x/ },
      { label: "remediation", pattern: /remediation/i },
      { label: "ECR build/push", pattern: /ecr/i },
      { label: "ECS service/task def", pattern: /ecs/i },
      { label: "IAM policy create and attach", pattern: /iam.*policy.*(create|attach)/is },
      { label: "Secrets Manager by ARN", pattern: /secrets\s?manager.*arn|arn.*secrets/is },
      { label: "ACM certificate", pattern: /acm/i },
      { label: "tier foundation vs application", pattern: /foundation.*application/is },
      { label: "cost estimation with sources", pattern: /cost.*(source|nat|alb|rds)/is },
      { label: "backup RDS snapshot", pattern: /rds.*snapshot|snapshot.*rds/is },
      {
        label: "revert previous task definition",
        pattern: /previous task definition|task definition revision/i,
      },
      { label: "log table CloudWatch tail", pattern: /aws logs tail/i },
      { label: "log Logs Insights bounded", pattern: /logs insights/i },
      { label: "log CloudTrail lookup-events", pattern: /lookup-events/i },
      { label: "sweep unassociated EIPs", pattern: /unassociated elastic ip|unassociated eip/is },
      { label: "sweep idle NAT", pattern: /idle nat|nat.*idle/is },
      {
        label: "sweep log groups without retention",
        pattern: /log group.*retention|retention.*log group/is,
      },
    ],
  },
  {
    name: "fly-ops",
    statements: [
      { label: "tool floor", pattern: /floor/i },
      { label: "flyctl tool declaration", pattern: /flyctl/ },
      { label: "auth probe whoami", pattern: /flyctl auth whoami/ },
      { label: "remediation", pattern: /remediation/i },
      { label: "apps create", pattern: /fly apps create/i },
      { label: "deploy with image", pattern: /fly deploy.*--image|--image.*fly deploy/is },
      { label: "secrets set/unset", pattern: /fly secrets (set|unset)/i },
      {
        label: "volumes and snapshots",
        pattern: /fly volumes.*snapshot|volumes snapshots create/is,
      },
      { label: "certs add/check", pattern: /fly certs (add|check)/i },
      { label: "scale", pattern: /fly scale/i },
      { label: "machine status", pattern: /fly machine/i },
      { label: "apps destroy", pattern: /fly apps destroy/i },
      { label: "tier foundation vs application", pattern: /foundation.*application/is },
      { label: "ephemeral ExpiresAt", pattern: /ephemeral.*ExpiresAt|ExpiresAt.*ephemeral/is },
      { label: "revert via fly releases", pattern: /fly releases/i },
      { label: "backup volume snapshot", pattern: /fly volumes snapshots create/i },
      { label: "log table fly logs since", pattern: /fly logs.*--since/i },
      { label: "cost machines/volumes/ips", pattern: /machines.*volumes.*(ip|dedicated)/is },
      {
        label: "sweep stopped machines / unattached volumes",
        pattern: /stopped machines|unattached volumes/i,
      },
    ],
  },
  {
    name: "supabase-ops",
    statements: [
      { label: "tool floor", pattern: /floor/i },
      { label: "supabase tool declaration", pattern: /supabase/ },
      { label: "auth probe projects list", pattern: /supabase projects list/ },
      { label: "version floor 2.x", pattern: /2\.\d|2\.x/ },
      { label: "remediation", pattern: /remediation/i },
      { label: "tier foundation vs application", pattern: /foundation.*application/is },
      { label: "db diff as plan", pattern: /db diff/i },
      {
        label: "destructive statements itemized",
        pattern: /destructive.*itemi|itemi.*destructive/is,
      },
      { label: "confirmation before db push", pattern: /confirm.*db push|db push.*confirm/is },
      { label: "migration list verification", pattern: /supabase migration list/i },
      {
        label: "drift reported never pushed",
        pattern: /drift.*(report|never).*push|never push.*drift/is,
      },
      { label: "backup db dump or PITR", pattern: /db dump|pitr/i },
      { label: "discovery MCP read-only", pattern: /mcp.*read-only|read-only.*mcp/is },
      {
        label: "no MCP write",
        pattern: /writes never go through mcp|never.*mcp.*write|no.*mcp.*write/is,
      },
      { label: "inventory has_legacy_keys", pattern: /has_legacy_keys/ },
      { label: "inventory rls_disabled_tables", pattern: /rls_disabled_tables/ },
      { label: "no key material", pattern: /no key material|never.*key material/is },
      { label: "secrets set", pattern: /supabase secrets set/i },
      { label: "publishable vs secret keys", pattern: /publishable.*secret|secret.*publishable/is },
      { label: "log table with retention caveat", pattern: /retention/i },
      { label: "researcher-cited log endpoint", pattern: /researcher/i },
      { label: "cost plan/compute/replicas/PITR", pattern: /plan.*compute.*(replica|pitr)/is },
      {
        label: "sweep branches past ExpiresAt",
        pattern: /branches.*ExpiresAt|ExpiresAt.*branch/is,
      },
    ],
  },
  {
    name: "deploy-ops",
    statements: [
      { label: "script contract table", pattern: /deploy\.sh.*deploy-verify\.sh.*rollback\.sh/is },
      {
        label: "environment mapping table",
        pattern: /main.*dev.*tag.*prod|tag.*prod.*main.*dev/is,
      },
      { label: "tag policy references github-ops", pattern: /github-ops/i },
      { label: "deploy-target framing", pattern: /deploy.?target/i },
      { label: "workflow scaffolding procedure", pattern: /scaffold/i },
      {
        label: "install dev workflow only when production false",
        pattern: /production:?\s*false/i,
      },
      { label: "yq tool 4.x", pattern: /yq.*4\.\d|yq.*4\.x/is },
      { label: "gh tool", pattern: /\bgh\b/ },
      {
        label: "package.json wrappers for JS/TS",
        pattern: /package\.json.*wrapper|wrapper.*package\.json/is,
      },
    ],
  },
];

/** Skills that are implemented so far; extend as each story lands. */
const IMPLEMENTED = new Set<string>(["aws-ops", "fly-ops", "supabase-ops", "deploy-ops"]);

function skillPaths(name: string): string[] {
  return TREES.map((tree) => `${tree}/${name}/SKILL.md`);
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return (match ? content.slice(match[0].length) : content).trim();
}

for (const skill of SKILLS) {
  if (!IMPLEMENTED.has(skill.name)) continue;

  const paths = skillPaths(skill.name);

  describe(`${skill.name} skill — presence`, () => {
    for (const relPath of paths) {
      it(`exists at ${relPath}`, () => {
        expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
      });
    }
  });

  describe(`${skill.name} skill — three-tree body parity`, () => {
    it("all three trees share identical body content (ignoring frontmatter)", () => {
      const bodies = paths.map((p) => stripFrontmatter(read(p)));
      expect(bodies[0]).toBe(bodies[1]);
      expect(bodies[0]).toBe(bodies[2]);
    });
  });

  describe(`${skill.name} skill — declared fields`, () => {
    for (const statement of skill.statements) {
      it(`declares ${statement.label} in all three trees`, () => {
        const missing = paths.filter(
          (relPath) =>
            !existsSync(resolve(ROOT, relPath)) || !statement.pattern.test(read(relPath)),
        );
        expect(
          missing,
          `statement "${statement.label}" absent from: ${missing.join(", ")}`,
        ).toEqual([]);
      });
    }
  });
}
