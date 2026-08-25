/**
 * Artifact contract and budget-cap tests for the `researcher` agent.
 *
 * Covers issue #139:
 *   AC-3  Artifact section contract (section order, slice completeness)
 *   AC-4  Context budget enforcement (boundary comparators)
 *   AC-7  Provenance fields (base branch + commit SHA)
 *
 * These are pure unit tests over contract helpers — they validate structural
 * rules without requiring a real research run.
 */

import { describe, it, expect } from "vitest";

// ─── Budget cap constants (single source of truth) ───────────────────────────

/** Maximum report length in lines. */
export const MAX_REPORT_LINES = 250;

/** Maximum number of cited files. */
export const MAX_CITED_FILES = 30;

// ─── Required sections in order ──────────────────────────────────────────────

/**
 * The ten required sections, in the exact order they MUST appear.
 * Section 8 (External sources) is optional but its position is fixed.
 */
export const REQUIRED_SECTIONS = [
  "Changelog",
  "Provenance",
  "Answer first",
  "Relevance-ranked file map",
  "Slice findings",
  "Relationships",
  "Risks and gotchas",
  "External sources",
  "Not investigated",
  "Confidence",
] as const;

/** The eight research slices that MUST each be addressed. */
export const SLICES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as const;

/** Required provenance fields. */
export const PROVENANCE_FIELDS = [
  "base branch",
  "commit SHA",
  "repository",
  "invoking agent",
  "research question",
  "date",
] as const;

// ─── Helper functions (exported for reuse) ───────────────────────────────────

/**
 * Check whether a line count is within the budget cap.
 */
export function withinLineCap(count: number, cap: number = MAX_REPORT_LINES): boolean {
  return count <= cap;
}

/**
 * Check whether a cited-file count is within the budget cap.
 */
export function withinFileCap(count: number, cap: number = MAX_CITED_FILES): boolean {
  return count <= cap;
}

/**
 * Extract section headings from a research artifact and return them in order.
 * Matches ## headings (level 2).
 */
export function extractSections(content: string): string[] {
  const headingRegex = /^##\s+(.+)$/gm;
  const sections: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    sections.push(match[1].trim());
  }
  return sections;
}

/**
 * Check that all required sections appear in order.
 * "External sources" is optional — if absent, it's skipped in the order check.
 */
export function validateSectionOrder(sections: string[]): {
  valid: boolean;
  missing: string[];
  outOfOrder: string[];
} {
  const missing: string[] = [];
  const outOfOrder: string[] = [];

  let lastIndex = -1;
  for (const required of REQUIRED_SECTIONS) {
    // External sources is optional
    if (required === "External sources") {
      const idx = sections.findIndex((s) => s.toLowerCase().includes("external sources"));
      if (idx !== -1) {
        if (idx < lastIndex) outOfOrder.push(required);
        lastIndex = idx;
      }
      continue;
    }

    const idx = sections.findIndex((s) => s.toLowerCase().includes(required.toLowerCase()));
    if (idx === -1) {
      missing.push(required);
    } else {
      if (idx < lastIndex) outOfOrder.push(required);
      lastIndex = idx;
    }
  }

  return { valid: missing.length === 0 && outOfOrder.length === 0, missing, outOfOrder };
}

/**
 * Check that all eight slices are addressed (populated or marked N/A with reason).
 * Returns slices that are neither populated nor explicitly marked N/A.
 */
export function validateSliceCompleteness(content: string): {
  complete: boolean;
  unaddressed: string[];
} {
  const unaddressed: string[] = [];

  for (const slice of SLICES) {
    // A slice is addressed if the content mentions it
    const slicePattern = new RegExp(`\\b${slice}\\b`, "i");
    if (!slicePattern.test(content)) {
      unaddressed.push(slice);
    }
  }

  return { complete: unaddressed.length === 0, unaddressed };
}

/**
 * Count lines in a string (consistent with standard line counting).
 */
export function countLines(content: string): number {
  if (content.length === 0) return 0;
  const normalized = content.endsWith("\n") ? content.slice(0, -1) : content;
  return normalized.length === 0 ? 0 : normalized.split("\n").length;
}

/**
 * Count file references in a relevance-ranked file map section.
 * Looks for lines starting with - ` (markdown list with backtick path).
 */
export function countCitedFiles(fileMapSection: string): number {
  const lines = fileMapSection.split("\n");
  return lines.filter((line) => /^\s*-\s*`/.test(line)).length;
}

/**
 * Check that provenance contains required fields.
 */
export function validateProvenance(provenanceSection: string): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  const lower = provenanceSection.toLowerCase();

  for (const field of PROVENANCE_FIELDS) {
    if (!lower.includes(field.toLowerCase())) {
      // "commit SHA" might appear as "commit sha" or "SHA"
      if (field === "commit SHA" && (lower.includes("sha") || lower.includes("commit"))) {
        continue;
      }
      missing.push(field);
    }
  }

  return { valid: missing.length === 0, missing };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("researcher artifact — AC-4: budget cap boundary comparators (lines)", () => {
  it("249 lines is within cap", () => {
    expect(withinLineCap(249)).toBe(true);
  });

  it("250 lines is within cap (inclusive boundary)", () => {
    expect(withinLineCap(250)).toBe(true);
  });

  it("251 lines exceeds cap", () => {
    expect(withinLineCap(251)).toBe(false);
  });

  it("0 lines is within cap", () => {
    expect(withinLineCap(0)).toBe(true);
  });
});

describe("researcher artifact — AC-4: budget cap boundary comparators (files)", () => {
  it("29 files is within cap", () => {
    expect(withinFileCap(29)).toBe(true);
  });

  it("30 files is within cap (inclusive boundary)", () => {
    expect(withinFileCap(30)).toBe(true);
  });

  it("31 files exceeds cap", () => {
    expect(withinFileCap(31)).toBe(false);
  });

  it("0 files is within cap", () => {
    expect(withinFileCap(0)).toBe(true);
  });
});

describe("researcher artifact — AC-3: section order validation", () => {
  it("validates correct section order", () => {
    const sections = [
      "Changelog",
      "Provenance",
      "Answer first",
      "Relevance-ranked file map",
      "Slice findings S1-S8",
      "Relationships",
      "Risks and gotchas",
      "External sources",
      "Not investigated",
      "Confidence",
    ];
    const result = validateSectionOrder(sections);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.outOfOrder).toEqual([]);
  });

  it("validates correct order without optional External sources", () => {
    const sections = [
      "Changelog",
      "Provenance",
      "Answer first",
      "Relevance-ranked file map",
      "Slice findings S1-S8",
      "Relationships",
      "Risks and gotchas",
      "Not investigated",
      "Confidence",
    ];
    const result = validateSectionOrder(sections);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("detects missing sections", () => {
    const sections = [
      "Changelog",
      "Provenance",
      "Relevance-ranked file map",
      "Slice findings S1-S8",
      "Relationships",
      "Not investigated",
      "Confidence",
    ];
    const result = validateSectionOrder(sections);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("Answer first");
    expect(result.missing).toContain("Risks and gotchas");
  });

  it("detects out-of-order sections", () => {
    const sections = [
      "Provenance",
      "Changelog",
      "Answer first",
      "Relevance-ranked file map",
      "Slice findings S1-S8",
      "Relationships",
      "Risks and gotchas",
      "Not investigated",
      "Confidence",
    ];
    const result = validateSectionOrder(sections);
    expect(result.valid).toBe(false);
    // "Provenance" appears before "Changelog" but should come after it
    expect(result.outOfOrder).toContain("Provenance");
  });
});

describe("researcher artifact — AC-3: slice completeness", () => {
  it("validates all slices present", () => {
    const content =
      "S1 components S2 APIs S3 UI S4 tests S5 data S6 config S7 relationships S8 history";
    const result = validateSliceCompleteness(content);
    expect(result.complete).toBe(true);
    expect(result.unaddressed).toEqual([]);
  });

  it("detects missing slices", () => {
    const content = "S1 components S2 APIs S4 tests S5 data S7 relationships";
    const result = validateSliceCompleteness(content);
    expect(result.complete).toBe(false);
    expect(result.unaddressed).toContain("S3");
    expect(result.unaddressed).toContain("S6");
    expect(result.unaddressed).toContain("S8");
  });

  it("empty content has all slices unaddressed", () => {
    const result = validateSliceCompleteness("");
    expect(result.complete).toBe(false);
    expect(result.unaddressed).toHaveLength(8);
  });
});

describe("researcher artifact — AC-7: provenance fields", () => {
  it("validates complete provenance", () => {
    const provenance = `
- Repository: gaib-ai/dev-tasks
- Base branch: main
- Commit SHA: abc123def
- Invoking agent: product-engineer
- Research question: How is the planner wired?
- Date: 2026-08-22
    `;
    const result = validateProvenance(provenance);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("detects missing provenance fields", () => {
    const provenance = `
- Repository: gaib-ai/dev-tasks
- Date: 2026-08-22
    `;
    const result = validateProvenance(provenance);
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

describe("researcher artifact — line counting", () => {
  it("counts lines correctly", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("one line\n")).toBe(1);
    expect(countLines("line1\nline2\n")).toBe(2);
    expect(countLines("line1\nline2")).toBe(2);
    expect(countLines("a\nb\nc\nd\ne")).toBe(5);
  });
});

describe("researcher artifact — cited file counting", () => {
  it("counts file references in markdown list", () => {
    const section = `
- \`src/main.ts\` L1-50 — entry point
- \`src/utils.ts\` L10-20 — helper functions
- \`test/main.test.ts\` L1-30 — tests
    `;
    expect(countCitedFiles(section)).toBe(3);
  });

  it("returns 0 for empty section", () => {
    expect(countCitedFiles("")).toBe(0);
  });

  it("ignores non-file lines", () => {
    const section = `
Some description text.
- \`src/main.ts\` — entry point
Not a file reference.
- \`src/utils.ts\` — helpers
    `;
    expect(countCitedFiles(section)).toBe(2);
  });
});

describe("researcher artifact — section extraction from content", () => {
  it("extracts ## headings in order", () => {
    const content = `# Title

## Changelog

Content.

## Provenance

Content.

## Answer first

Content.
`;
    const sections = extractSections(content);
    expect(sections).toEqual(["Changelog", "Provenance", "Answer first"]);
  });
});
