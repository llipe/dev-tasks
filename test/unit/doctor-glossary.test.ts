/**
 * `doctor`'s glossary-presence check (S-001 AC-5, D-67, CT-10, UT-D1..UT-D5).
 *
 * The check warns on absence only. Absence is a delivery problem `dev-tasks
 * update` fixes; an empty-but-present glossary is the correct state of every
 * fresh install, and a structurally broken one is `lint`'s business, never
 * `doctor`'s. So this check never fails and never reports on content.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkGlossaryPresence, runDoctor } from "#core/distribution/doctor.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const GLOSSARY_REL = "docs/domain/ubiquitous-language.md";

const EMPTY_GLOSSARY = `---
version: 1.0
name: Ubiquitous Language
description: Canonical domain vocabulary, organized by bounded context.
status: unfilled
owner: product-engineer
---

# Ubiquitous Language

## Changelog

| Version | Date | Summary | Author |
| ------- | ---- | ------- | ------ |
`;

const POPULATED_GLOSSARY = `${EMPTY_GLOSSARY}
## Bounded Context: AI-assisted development workflow

### decision log

- Definition: The append-only record of decisions for a feature.
- Forbidden synonyms: none
- Invariants: Append-only.
- Origin: docs/requirements/prd-shared-understanding-refinement.md FR-4
- Status: active
`;

describe("checkGlossaryPresence (D-67)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-doctor-glossary-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeGlossary(content: string): void {
    mkdirSync(join(tmpDir, "docs/domain"), { recursive: true });
    writeFileSync(join(tmpDir, GLOSSARY_REL), content, "utf-8");
  }

  it("UT-D1: warns when the file is absent, proposing `dev-tasks update`", () => {
    const result = checkGlossaryPresence(tmpDir);
    expect(result.name).toBe("glossary");
    expect(result.pass).toBe(true);
    expect(result.warn).toBe(true);
    expect(result.message).toContain("dev-tasks update");
    expect(result.message).toContain(GLOSSARY_REL);
  });

  it("UT-D2: is silent when the file is present with zero terms", () => {
    writeGlossary(EMPTY_GLOSSARY);
    const result = checkGlossaryPresence(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.warn).toBeUndefined();
  });

  it("UT-D3: is silent when the file is present and populated", () => {
    writeGlossary(POPULATED_GLOSSARY);
    const result = checkGlossaryPresence(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.warn).toBeUndefined();
  });

  it("UT-D4: is silent when the file is present but structurally broken", () => {
    // Structure is `lint`'s concern (D-66). `doctor` reporting it here would
    // make two tools answer the same question, and disagree the first time
    // one of them changes.
    writeGlossary("not a glossary at all\n");
    const result = checkGlossaryPresence(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.warn).toBeUndefined();
  });

  it("UT-D4b: is silent when the file is present but empty", () => {
    writeGlossary("");
    const result = checkGlossaryPresence(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.warn).toBeUndefined();
  });

  it("UT-D5: is registered in runDoctor() and never reports pass: false", async () => {
    const checks = await runDoctor({ repoRoot: tmpDir, cacheDir: join(tmpDir, ".cache") });
    const glossary = checks.find((c) => c.name === "glossary");
    expect(glossary, "runDoctor() does not include the glossary check").toBeDefined();
    expect(glossary?.pass).toBe(true);
  });
});
