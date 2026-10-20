/**
 * Parity and static checks for the projects-tracking PRD, wave 1
 * (conventions and hierarchy). One `describe` block per changed prompt
 * file, each `it` reading the three platform tree copies and asserting a
 * marker sentence or table row with `toContain`, section-scoped where a
 * section must contain or lack a line (D-34).
 *
 * Helpers are copied from `skill-parity-init.test.ts` (`stripFrontmatter`)
 * and `claude-tool-declaration-parity.test.ts` (`splitIntoSections`) so
 * this file has no cross-test import.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

/** Strip platform-specific frontmatter (YAML between ---) for comparison */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

/**
 * Split the body into (heading, sectionText) pairs so assertions can be
 * scoped to their nearest enclosing heading. The "preamble" before the
 * first heading is recorded under an empty heading string. Lines inside a
 * ``` fence are never headings: fenced templates (the wave issue body, the
 * status comment) carry `##` lines that belong to the enclosing section.
 */
function splitIntoSections(body: string): Array<{ heading: string; text: string }> {
  const lines = body.split("\n");
  const sections: Array<{ heading: string; text: string }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      currentLines.push(line);
      continue;
    }
    const headingMatch = inFence ? null : line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      sections.push({ heading: currentHeading, text: currentLines.join("\n") });
      currentHeading = headingMatch[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ heading: currentHeading, text: currentLines.join("\n") });
  return sections;
}

interface TreeCopy {
  tree: string;
  path: string;
  body: string;
  sections: Array<{ heading: string; text: string }>;
}

function loadTrees(paths: Record<string, string>): TreeCopy[] {
  return Object.entries(paths).map(([tree, path]) => {
    const body = stripFrontmatter(readFileSync(resolve(ROOT, path), "utf-8"));
    return { tree, path, body, sections: splitIntoSections(body) };
  });
}

/**
 * Select one section by heading text and, optionally, by a substring of its
 * body — github-ops has two `### Title Format` sections (issues and PRs), so
 * the issue table is the one whose text contains `PRD story` (A-15).
 */
function sectionOf(copy: TreeCopy, heading: string, containing?: string): string {
  const match = copy.sections.find(
    (s) => s.heading.includes(heading) && (containing === undefined || s.text.includes(containing)),
  );
  expect(match, `${copy.path}: no section with heading containing "${heading}"`).toBeDefined();
  return match!.text;
}

/**
 * Collapse runs of spaces so a table row can be matched on its cell names
 * regardless of the column padding prettier applies.
 */
function squashSpaces(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

// --- helpers -----------------------------------------------------------------

describe("helpers", () => {
  // qa-engineer S-001 gate: a `##` line inside a fenced block is template text,
  // not a heading — the wave body template (S-002) carries `## Artifacts` and
  // `## Stories` inside a fence, which must not cut the Process section short.
  it("splitIntoSections ignores headings inside code fences", () => {
    const body = [
      "## Process",
      "step one",
      "```markdown",
      "## Artifacts",
      "inside the fence",
      "```",
      "step two",
      "## Next",
      "after",
    ].join("\n");
    const sections = splitIntoSections(body);
    expect(sections.map((s) => s.heading)).toEqual(["", "Process", "Next"]);
    const process = sections.find((s) => s.heading === "Process")!;
    expect(process.text).toContain("## Artifacts");
    expect(process.text).toContain("step two");
  });
});

// --- github-ops (S-001, #270) -------------------------------------------------

const GITHUB_OPS_TREES = {
  claude: ".claude/agents/github-ops.md",
  github: ".github/agents/github-ops.agent.md",
  kiro: ".kiro/agents/github-ops.md",
};

describe("github-ops", () => {
  const trees = loadTrees(GITHUB_OPS_TREES);

  // PT-1 / CT-5 — S-001 AC-1; FR-1, D-04, D-32
  it("title forms", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Title Format", "PRD story");
      expect(section, copy.path).toMatch(
        /^\| PRD tracking issue\s+\| `\[PRD-<name>\] <PRD title>`/m,
      );
      expect(section, copy.path).toMatch(
        /^\| Wave tracking issue\s+\| `\[PRD-<name>\] Wave <id>: <title>`/m,
      );
      const idSentence = section
        .split("\n")
        .find((line) => line.includes("Phase/Wave") && line.includes("docs/roadmap.md"));
      expect(idSentence, `${copy.path}: no sentence deriving <id> from the roadmap`).toBeDefined();
      // The story form is unchanged.
      expect(section, copy.path).toMatch(
        /^\| PRD story\s+\| `\[PRD-<name>\] Story <ID>: <Title>`/m,
      );
    }
  });

  // PT-2 / CT-6 — S-001 AC-2; FR-2, FR-7, D-03, D-05
  it("level labels and exemption", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Standardized Main Issue Tags");
      expect(section, copy.path).toContain("**Level**");
      for (const label of ["level: prd", "level: wave", "level: story", "status: deferred"]) {
        const row = new RegExp(`^\\|.*\`${label}\`\\s*\\|\\s*\`#[0-9A-F]{6}\``, "m");
        expect(section, `${copy.path}: no colored row for ${label}`).toMatch(row);
      }
      const ruleLine = section
        .split("\n")
        .find((line) => line.includes("at least one `type:` label and one `priority:` label"));
      expect(ruleLine, `${copy.path}: type/priority rule line missing`).toBeDefined();
      expect(ruleLine, copy.path).toContain("except issues labeled `level: prd` or `level: wave`");
    }
  });

  // PT-3 — S-001 AC-2, AC-5; FR-7, D-07, D-31
  it("no stage labels", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "Standardized Main Issue Tags");
      // Row-scoped (`^|`), so a prose note that the labels were retired cannot false-fail (EC-3).
      expect(section, copy.path).not.toMatch(/^\|.*`status: ready`/m);
      expect(section, copy.path).not.toMatch(/^\|.*`status: in-progress`/m);
      // The flags stay.
      expect(section, copy.path).toMatch(/^\|.*`status: blocked`/m);
      expect(section, copy.path).toMatch(/^\|.*`status: needs-refinement`/m);
      // Wave 1 retires the rows from the taxonomy only; existing issues are untouched (D-31).
      expect(copy.body, copy.path).not.toMatch(/remove .*status: ready/i);
    }
  });

  // PT-4 / CT-1 to CT-4 — S-001 AC-3; FR-23, D-12, D-25, D-26, D-33, D-37
  it("status comment subsection", () => {
    const storyHeader = "| Sub-tasks | Current | Branch | PR | Gates | Blocker | Updated |";
    const waveHeader = "| Story | State | PR | Sub-task |";
    const prdHeader = "| Wave | State | Wave issue |";
    for (const copy of trees) {
      const section = sectionOf(copy, "Status comment");
      const squashed = squashSpaces(section);
      expect(section, copy.path).toContain("<!-- dev-tasks:status -->");
      expect(section, copy.path).toContain("🔄 Update:");
      expect(section, copy.path).toContain("Refs #<issue>");
      expect(squashed, copy.path).toContain(storyHeader);
      expect(squashed, copy.path).toContain(waveHeader);
      expect(squashed, copy.path).toContain(prdHeader);
      for (const label of ["Current story", "Last merged PR", "Integration HEAD", "Gates"]) {
        expect(section, `${copy.path}: wave summary line "${label}" missing`).toContain(label);
      }
      expect(section, copy.path).toContain("gh api -X PATCH");
      expect(section, copy.path).toContain("exactly one");
      expect(section, copy.path).toContain("append-only");
      // CT-1: every fenced template starts with the marker on line one, no leading
      // whitespace, and the `🔄 Update:` line with `Refs #<issue>` on line two.
      const fences = section.match(/```text\n[\s\S]*?```/g) ?? [];
      expect(fences.length, `${copy.path}: no fenced status-comment template`).toBeGreaterThan(0);
      for (const fence of fences) {
        expect(fence, copy.path).toMatch(
          /^```text\n<!-- dev-tasks:status -->\n🔄 Update:[^\n]*Refs #<issue>/,
        );
      }
      // A-10: "progress comment" is a forbidden synonym of "status comment".
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
    }
  });

  // PT-5 — S-001 AC-4; D-16, D-41
  it("gh primary", () => {
    const identity =
      "GitHub operations **MUST** run through the `gh` CLI (over Bash). If a GitHub MCP server is configured in this session, you **MAY** use it instead; whichever method is used **MUST** be noted in the operation summary.";
    for (const copy of trees) {
      expect(copy.body, copy.path).toContain("`gh` CLI is the primary execution path");
      expect(copy.body, copy.path).toContain(identity);
      // A-3 / D-41: no passage still makes MCP primary.
      expect(copy.body, copy.path).not.toContain("run through GitHub MCP when available");
      expect(copy.body, copy.path).not.toContain("(Fallback When MCP Is Unavailable)");
      expect(copy.body, copy.path).not.toMatch(/falling back to `gh`/);
      expect(copy.body, copy.path).not.toMatch(/\*\*MCP first\.\*\*/);
      expect(copy.body, copy.path).not.toMatch(/required path whenever MCP/);
    }
  });
});

// --- activity-publish-github (S-002, #271) -----------------------------------

const PUBLISH_TREES = {
  claude: ".claude/skills/activity-publish-github/SKILL.md",
  github: ".github/skills/activity-publish-github/SKILL.md",
  kiro: ".kiro/skills/activity-publish-github/SKILL.md",
};

const TRACKING_SEARCH =
  'gh issue list --label "level: prd" --search "[PRD-<name>] in:title" --state open';

describe("activity-publish-github", () => {
  // The `.github/` copy has no YAML frontmatter, so `stripFrontmatter` is a
  // no-op there and every assertion is `toContain`, never `toBe` (A-15, EC-12).
  const trees = loadTrees(PUBLISH_TREES);

  // PT-6 — S-002 AC-1; FR-9, D-16; PRD AC-6
  it("gh primary", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).toMatch(/`gh`[^\n]*primary/);
      expect(copy.body, copy.path).toMatch(/MCP[^\n]*optional/);
      expect(copy.body, copy.path).toContain("**MUST** be recorded in the publication report");
      expect(copy.body, copy.path).not.toContain("GitHub MCP **SHOULD** be used when available");
      // The github-ops delegation fallback sentence is unchanged.
      expect(copy.body, copy.path).toContain(
        "If `github-ops` delegation is unavailable in the current runtime",
      );
    }
  });

  // PT-7 / CT-11 — S-002 AC-2; FR-3, D-36; A-13 client-side filter
  it("find-or-create", () => {
    for (const copy of trees) {
      const process = sectionOf(copy, "Process");
      expect(process, copy.path).toContain(TRACKING_SEARCH);
      expect(process, copy.path).toContain('--label "level: wave"');
      expect(process, copy.path).toContain("Wave <id>:");
      expect(process, copy.path).toContain('startswith("[PRD-<name>]")');
      expect(process, copy.path).toMatch(/--jq[^\n]*startswith/);
      // The three outcomes, as text.
      expect(process, copy.path).toMatch(/one match[^\n]*reuse/i);
      expect(process, copy.path).toMatch(/zero[^\n]*create/i);
      expect(process, copy.path).toMatch(/more than one[^\n]*stop[^\n]*list/i);
      // The search runs before story creation: the find-or-create step comes first.
      expect(process.indexOf(TRACKING_SEARCH), copy.path).toBeLessThan(
        process.indexOf("one GitHub Issue per user story"),
      );
    }
  });

  // PT-8 — S-002 AC-2; FR-3
  it("no epic question", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).not.toContain("parent epic issue or project board association");
      const questions = sectionOf(copy, "Clarifying Questions");
      for (const line of questions.split("\n")) {
        expect(line, `${copy.path}: question still asks for an epic or board`).not.toMatch(
          /epic|project board/i,
        );
      }
    }
  });

  // PT-9 / CT-8 — S-002 AC-3; FR-4, D-14
  it("wave body template", () => {
    for (const copy of trees) {
      const fences = copy.body.match(/```[a-z]*\n[\s\S]*?```/g) ?? [];
      const fence = fences.find((f) => f.includes("Integration branch: TBD"));
      expect(fence, `${copy.path}: no fenced wave issue body template`).toBeDefined();
      expect(fence!, copy.path).toMatch(/^Scope:/m);
      expect(fence!, copy.path).toContain("## Artifacts");
      expect(fence!, copy.path).toContain("Task plan: pending");
      expect(fence!, copy.path).toContain("## Stories");
      // Two root-relative links: the spec and the story set.
      const links = fence!.match(/\]\(\/workstream\/[^)]+\)/g) ?? [];
      expect(links.length, `${copy.path}: expected two root-relative links`).toBeGreaterThanOrEqual(
        2,
      );
      // No checkboxes in the wave body; the story template's AC checkboxes
      // elsewhere in the file are untouched (EC-13).
      expect(fence!, copy.path).not.toContain("- [ ]");
    }
  });

  // PT-10 — S-002 AC-4; FR-3, D-02
  it("sub-issue attach and verify", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).toContain("/sub_issues");
      expect(copy.body, copy.path).toContain("sub_issue_id");
      expect(copy.body, copy.path).toContain("--jq .id");
      expect(copy.body, copy.path).toContain("hierarchy: verified(<n> of <n>)");
      expect(copy.body, copy.path).toContain("failed(<reason>)");
      expect(copy.body, copy.path).toContain("if not already");
      // Every body goes through a file; git-guard blocks inline `--body`.
      expect(copy.body, copy.path).not.toContain('--body "');
      expect(copy.body, copy.path).toContain("--body-file");
    }
  });

  // PT-11 — S-002 AC-5; FR-3
  it("report fields", () => {
    for (const copy of trees) {
      const report = sectionOf(copy, "Output Structure");
      expect(report, copy.path).toMatch(/^- PRD issue:/m);
      expect(report, copy.path).toMatch(/^- Wave issue:/m);
      expect(report, copy.path).toMatch(/^- Hierarchy:/m);
      const final = sectionOf(copy, "Final Instructions");
      expect(final, copy.path).toContain("hierarchy");
    }
  });
});

// --- implement (S-003, #272) -------------------------------------------------

const IMPLEMENT_TREES = {
  claude: ".claude/skills/implement/SKILL.md",
  github: ".github/instructions/implement.instructions.md",
  kiro: ".kiro/steering/implement.md",
};

describe("implement", () => {
  // Frontmatter differs per tree (skill, `applyTo` instruction, `fileMatchPattern`
  // steering); the bodies are byte-identical and `memo-write-reliability.test.ts`
  // pins the `## Before Starting Work` … `## GitHub Execution Rules` span, which
  // contains every edit below (A-15, EC-19).
  const trees = loadTrees(IMPLEMENT_TREES);

  // `## During Implementation` is split at its `###` subsections, so the
  // assertions are scoped to the span up to `## Before Closing` instead.
  function duringImplementation(copy: TreeCopy): string {
    const span = copy.body.match(/## During Implementation[\s\S]*?## Before Closing/)?.[0];
    expect(span, `${copy.path}: no During Implementation span`).toBeDefined();
    return span!;
  }

  // PT-12 — S-003 AC-1; FR-23, D-25, D-38
  it("mandatory rule", () => {
    for (const copy of trees) {
      const section = duringImplementation(copy);
      expect(section, copy.path).toMatch(/\*\*MUST\*\* keep the story's status comment current/);
      expect(section, copy.path).toContain("Status comment");
      for (const event of [
        "first sub-task completion",
        "PR open",
        "each gate recorded",
        "on block",
      ]) {
        expect(section, `${copy.path}: event "${event}" missing`).toContain(event);
      }
      // The template is referenced, never restated (D-33): no fenced status table here.
      expect(copy.body, copy.path).not.toContain("| Sub-tasks ");
    }
  });

  // PT-13 — S-003 AC-1; FR-23; A-10 / EC-20 vocabulary
  it("old optional rule gone", () => {
    for (const copy of trees) {
      expect(copy.body, copy.path).not.toContain("**SHOULD** add brief issue or PR comments");
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
      const final = sectionOf(copy, "Final Instructions");
      expect(final, copy.path).toContain("status comment");
    }
  });

  // PT-14 / CT-1 / CT-7 — S-003 AC-2; D-26, D-28, D-37; A-8 duplicate case (EC-15)
  it("procedure and report field", () => {
    for (const copy of trees) {
      const section = duringImplementation(copy);
      expect(section, copy.path).toContain("issues/{n}/comments --paginate");
      expect(section, copy.path).toContain('startswith("<!-- dev-tasks:status -->")');
      expect(section, copy.path).toContain("gh issue comment");
      expect(section, copy.path).toContain("--body-file");
      expect(section, copy.path).toContain("gh api -X PATCH");
      expect(section, copy.path).toContain("issues/comments/{id}");
      expect(section, copy.path).toContain("-F body=@");
      expect(section, copy.path).toContain(
        "status_comment: written | failed(<reason>) | skipped(no issue)",
      );
      expect(section, copy.path).toContain("failed(duplicate marker)");
      // EC-17: the marker is the first byte of the body file.
      expect(section, copy.path).toMatch(/first byte/);
      // Every body goes through a file; git-guard blocks inline `--body`.
      expect(copy.body, copy.path).not.toContain('--body "');
    }
  });

  // PT-15 / CT-7 — S-003 AC-3; FR-24, D-29; A-8 missing-comment case (EC-18)
  it("main-thread wave update", () => {
    for (const copy of trees) {
      const section = duringImplementation(copy);
      expect(section, copy.path).toContain("issues/{n}/parent");
      expect(section, copy.path).toContain("PR open");
      expect(section, copy.path).toContain("PR ready");
      expect(section, copy.path).toContain("404");
      expect(section, copy.path).toContain("wave_status: skipped(no parent)");
      expect(section, copy.path).toContain("wave_status: owned-by-planner");
      expect(section, copy.path).toContain("wave_status: written");
      // Parent found but the wave has no status comment yet: create it (A-8).
      expect(section, copy.path).toMatch(/no status comment[^\n]*create/i);
    }
  });

  // PT-16 — S-003 AC-4; FR-23
  it("checklist rules unchanged", () => {
    for (const copy of trees) {
      const section = duringImplementation(copy);
      expect(section, copy.path).toContain("Mark it `[x]` in the GitHub Issue checklist.");
      expect(section, copy.path).toContain(
        "keep the local task list and the GitHub Issue checklist aligned at all times",
      );
      expect(section, copy.path).toContain(
        "you **MUST** reconcile immediately and report the reconciliation",
      );
    }
  });

  // S-003 AC-4; FR-23 — the lifecycle table's "During" row names the status comment.
  it("lifecycle row", () => {
    for (const copy of trees) {
      const section = sectionOf(copy, "GitHub Execution Rules Summary");
      const during = section.split("\n").find((line) => line.startsWith("| **During coding**"));
      expect(during, `${copy.path}: no During coding row`).toBeDefined();
      expect(during!, copy.path).toMatch(/status comment/i);
      // The "Before coding" row is unchanged (spec §8.3).
      expect(squashSpaces(section), copy.path).toContain(
        "| **Before coding** | Confirm issue open → Create branch (`github-ops`) → First commit → Open draft PR (`github-ops`) → Sync checklists",
      );
    }
  });
});

// --- developer (S-004, #273) -------------------------------------------------

const DEVELOPER_TREES = {
  claude: ".claude/agents/developer.md",
  github: ".github/agents/developer.agent.md",
  kiro: ".kiro/agents/developer.md",
};

describe("developer", () => {
  // The three copies differ in delegation wording (EC-25), so every assertion
  // is marker-only; no equality across trees. The `/developer` command
  // inherits through the collapse that `developer-command-collapse.test.ts`
  // pins (LT-4, S-004 AC-4), so `.claude/commands/developer.md` is not read here.
  const trees = loadTrees(DEVELOPER_TREES);

  function closeoutPayload(copy: TreeCopy): string {
    const span = copy.body.match(/BEGIN CLOSEOUT PAYLOAD[\s\S]*?END CLOSEOUT PAYLOAD/)?.[0];
    expect(span, `${copy.path}: no closeout payload`).toBeDefined();
    return span!;
  }

  // PT-19 / CT-7 — S-004 AC-1; FR-23, D-28, D-30. `wave_status` carries four
  // values: implement already emits `failed(<reason>)` when the wave comment
  // edit is refused (fidelity-report-S-003 DR-1), so the developer vocabulary
  // pins `written | failed(<reason>) | skipped(<reason>) | owned-by-planner`.
  it("report fields", () => {
    const syncLine = "checklist_sync: synced | mismatch-fixed | blocked";
    const statusLine = "status_comment: written | failed(<reason>) | skipped(<reason>)";
    const waveLine =
      "wave_status: written | failed(<reason>) | skipped(<reason>) | owned-by-planner";
    for (const copy of trees) {
      const lines = closeoutPayload(copy).split("\n");
      const indexOf = (needle: string): number => {
        const hits = lines.filter((line) => line.includes(needle));
        expect(hits.length, `${copy.path}: expected exactly one "${needle}"`).toBe(1);
        return lines.findIndex((line) => line.includes(needle));
      };
      const sync = indexOf(syncLine);
      const status = indexOf(statusLine);
      const wave = indexOf(waveLine);
      // Both new lines sit within three lines of `checklist_sync:` (D-30).
      expect(
        Math.abs(status - sync),
        `${copy.path}: status_comment not beside checklist_sync`,
      ).toBeLessThanOrEqual(3);
      expect(
        Math.abs(wave - sync),
        `${copy.path}: wave_status not beside checklist_sync`,
      ).toBeLessThanOrEqual(3);
      // EC-22 / D-28: the no-issue floor is named in the payload rules, and
      // the planner-run value is named so the subagent never omits the field.
      expect(copy.body, copy.path).toContain("skipped(no issue)");
      expect(copy.body, copy.path).toContain("wave_status: owned-by-planner");
    }
  });

  // PT-20 — S-004 AC-2; D-22 (FR-13 wording)
  it("close rule", () => {
    for (const copy of trees) {
      const rules = sectionOf(copy, "Non-Negotiable Operating Rules");
      expect(rules, copy.path).toContain(
        "You **MUST NOT** close the issue; GitHub closes it when the consolidated PR merges to main",
      );
      expect(copy.body, copy.path).not.toContain("close only after the PR is approved and merged");
    }
  });

  // PT-21 / CT-2 — S-004 AC-3; D-33, D-38
  it("pointer not copy", () => {
    const storyHeader = "| Sub-tasks | Current | Branch | PR | Gates | Blocker | Updated |";
    for (const copy of trees) {
      const rules = sectionOf(copy, "Non-Negotiable Operating Rules");
      const pointer = rules
        .split("\n")
        .find((line) => /status comment/i.test(line) && line.includes("implement"));
      expect(
        pointer,
        `${copy.path}: no rule line pointing to implement's status comment procedure`,
      ).toBeDefined();
      // The pointer names implement's section, so a reader can find the procedure.
      expect(pointer!, copy.path).toContain("Status Comment");
      // Negative: the procedure and the template are never restated here.
      expect(copy.body, copy.path).not.toContain("gh api -X PATCH");
      expect(copy.body, copy.path).not.toContain("issues/comments/{id}");
      expect(copy.body, copy.path).not.toContain("--body-file");
      expect(squashSpaces(copy.body), copy.path).not.toContain(storyHeader);
      // A-10: "progress comment" is a forbidden synonym of "status comment".
      expect(copy.body, copy.path).not.toMatch(/progress comments?/i);
    }
  });
});

// --- activity-init (S-005, #274) ---------------------------------------------

const INIT_TREES = {
  claude: ".claude/skills/activity-init/SKILL.md",
  github: ".github/skills/activity-init/SKILL.md",
  kiro: ".kiro/skills/activity-init/SKILL.md",
};

const INIT_HEADING = "Repository Setup — GitHub Project (Recommended)";
const RUNBOOK_PATH = "docs/runbooks/runbook-configure-github-project.md";

/**
 * Project Status is never written by an agent (D-23); the only `gh project`
 * verbs that may appear anywhere in the runbook are setup verbs (`create`,
 * `field-delete`, `view`, `field-list`). S-006's guard extends this walk to
 * the three trees and `docs/` (D-44); PT-25 carries the negative for the
 * runbook file in wave 1.
 */
const FORBIDDEN_PROJECT_WRITE = /gh\s+project\s+item-(edit|add)\b/;

/** PRD AC-5: no step changes a default automation. */
const AUTOMATION_TOGGLE =
  /(turn off|disable|enable|switch on|switch off)[^\n]*(workflow|automation)/i;

describe("activity-init", () => {
  const trees = loadTrees(INIT_TREES);

  // PT-23 — S-005 AC-1, AC-6; FR-8, D-10, D-40
  it("init subsection", () => {
    for (const copy of trees) {
      const headings = copy.sections.map((s) => s.heading);
      const at = headings.indexOf(INIT_HEADING);
      expect(at, `${copy.path}: no "${INIT_HEADING}" section`).toBeGreaterThan(-1);
      // Placement: after Branch Protection, before Document Changelog Convention (spec §8.4).
      expect(headings[at - 1], copy.path).toBe("Repository Setup — Branch Protection (Required)");
      expect(headings[at + 1], copy.path).toBe("Document Changelog Convention");
      // A `## ` sibling, not a `### ` child (D-40): the raw body carries the `## ` line.
      expect(copy.body, copy.path).toContain(`\n## ${INIT_HEADING}\n`);

      const text = sectionOf(copy, INIT_HEADING);
      expect(text, copy.path).toContain(RUNBOOK_PATH);
      // At most four sentences, counted after inline code spans and link
      // targets are removed so a path's dots do not count (EC-29).
      const prose = text.replace(/`[^`]*`/g, "").replace(/\]\([^)]*\)/g, "]");
      const terminators = prose.match(/[.!?](\s|$)/g) ?? [];
      expect(
        terminators.length,
        `${copy.path}: subsection has more than four sentences`,
      ).toBeLessThanOrEqual(4);
      expect(terminators.length, `${copy.path}: subsection is empty`).toBeGreaterThan(0);
      // No numbered step: the 54-step pin in skill-parity-init stays (A-1).
      expect(text, copy.path).not.toMatch(/^[0-9]+\. /m);
    }
  });

  // PT-25 / CT-10 — S-005 AC-2, AC-3; FR-8, PRD AC-5; D-10, D-22, D-23, D-35, D-43, D-44
  it("runbook steps", () => {
    const content = readFileSync(resolve(ROOT, RUNBOOK_PATH), "utf-8");
    const sections = splitIntoSections(stripFrontmatter(content));
    const section = (heading: string): string => {
      const match = sections.find((s) => s.heading === heading);
      expect(match, `${RUNBOOK_PATH}: no "${heading}" section`).toBeDefined();
      return match!.text;
    };

    // CT-10: frontmatter in the quoted inline form the runbook-set parser reads (EC-31).
    expect(content).toMatch(/^---\nname: runbook-configure-github-project\n/);
    expect(content).toMatch(/^owner: product-engineer$/m);
    expect(content).toMatch(/^last_verified: \d{4}-\d{2}-\d{2}$/m);
    expect(content).toMatch(/^related: \["docs\/requirements\/prd-projects-tracking\.md"\]$/m);

    const steps = section("Steps");
    for (const marker of [
      "gh auth refresh -s project",
      "Board",
      "is:issue",
      "Priority",
      "Size",
      "Estimate",
      "Start date",
      "Target date",
      "Item added",
      "Item closed",
      "Item reopened",
      "Pull request linked to issue",
      "Parent issue",
      'label:"status: blocked"',
      "level:",
    ]) {
      expect(steps, `Steps lacks "${marker}"`).toContain(marker);
    }
    // Verification uses the two read verbs (D-10).
    const verification = section("Verification");
    expect(verification).toContain("gh project view");
    expect(verification).toContain("gh project field-list");

    // A-5 / D-43: Auto-close issue is off by default and left alone; the
    // exercise records the exact names shown on the Workflows page.
    expect(content).toContain("Auto-close issue");
    expect(content).toMatch(/off by\s+default/);
    expect(content).toMatch(/Workflows page/);

    // Edge cases: the repository setting that enables Projects (EC-26) and
    // `--owner` for user versus organization projects (EC-27).
    const preconditions = section("Preconditions");
    expect(preconditions).toMatch(/Projects/);
    expect(preconditions).toMatch(/Settings/);
    expect(content).toContain("--owner");

    // Negatives: no Project write anywhere (D-23, D-44); no step toggles a
    // default automation (PRD AC-5).
    for (const [index, line] of content.split("\n").entries()) {
      expect(line, `${RUNBOOK_PATH}:${index + 1} writes a Project item`).not.toMatch(
        FORBIDDEN_PROJECT_WRITE,
      );
    }
    for (const [index, line] of steps.split("\n").entries()) {
      expect(line, `${RUNBOOK_PATH} Steps line ${index + 1} toggles an automation`).not.toMatch(
        AUTOMATION_TOGGLE,
      );
    }
  });
});
