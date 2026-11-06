import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SKILL = ".claude/skills/parallel-lanes";
const read = (path: string): string => readFileSync(path, "utf8");

describe("parallel-lanes memory instructions (#345)", () => {
  it.each(["worker.md", "prep.md", "coordinator.md"])(
    "%s recalls with a budget that leaves room for the agent's own lessons",
    (file) => {
      const recall = read(`${SKILL}/references/${file}`)
        .split("\n")
        .find((line) => line.includes("memo recall"));
      expect(recall).toContain("--max-tokens 6000");
    },
  );

  it("the retro write states the kind that reaches MINE, and create-new", () => {
    const section = read(`${SKILL}/references/lifecycle.md`).split("## Storing lessons")[1] ?? "";
    expect(section).toContain("memo write --kind semantic --bank <agent>-memory");
    expect(section).toContain("--on-duplicate create-new");
  });

  it("no reference leaves the write flags to the reader", () => {
    for (const file of ["worker.md", "prep.md", "lifecycle.md"]) {
      expect(read(`${SKILL}/references/${file}`)).not.toContain("memo write --bank <agent>-memory");
    }
  });

  it.each([".claude", ".github", ".kiro"])(
    "%s memo-cli-usage shows a semantic lesson in a private bank",
    (tree) => {
      const skill = read(`${tree}/skills/memo-cli-usage/SKILL.md`);
      const lesson = skill.split("### Lesson Entry")[1]?.split("## Entry Types")[0] ?? "";
      expect(lesson).toContain("--kind semantic");
      expect(lesson).toContain("--bank <agent>-memory");
      expect(lesson).toContain("--on-duplicate create-new");
    },
  );

  it.each(["AGENTS.md", "AGENTS.md.template", "CLAUDE.md", "CLAUDE.md.template", "README.md"])(
    "%s registers the skill",
    (file) => {
      expect(read(file)).toContain("parallel-lanes");
    },
  );
});
