/**
 * Unit tests for core/extract/prompt.ts.
 * Tests: TTY detection, non-interactive mode returns empty values.
 */

import { describe, it, expect } from "vitest";
import { isInteractive, promptNonDerivableFields, confirmInference } from "#core/extract/prompt.js";

describe("core/extract/prompt — isInteractive()", () => {
  it("returns a boolean", () => {
    const result = isInteractive();
    expect(typeof result).toBe("boolean");
  });

  it("returns false in test environment (not a TTY)", () => {
    // In test environment, stdin is not a TTY
    expect(isInteractive()).toBe(false);
  });
});

describe("core/extract/prompt — promptNonDerivableFields()", () => {
  it("returns empty values when not interactive", async () => {
    const result = await promptNonDerivableFields(false);
    expect(result).toEqual({
      owner: "",
      domain: "",
      criticality: "",
      lifecycle: "",
    });
  });

  it("returns all required field keys", async () => {
    const result = await promptNonDerivableFields(false);
    expect(Object.keys(result)).toContain("owner");
    expect(Object.keys(result)).toContain("domain");
    expect(Object.keys(result)).toContain("criticality");
    expect(Object.keys(result)).toContain("lifecycle");
  });
});

describe("core/extract/prompt — confirmInference()", () => {
  it("returns false when not interactive (unconfirmed)", async () => {
    const result = await confirmInference("description", "A test service", false);
    expect(result).toBe(false);
  });

  it("always returns false for non-interactive mode regardless of field", async () => {
    expect(await confirmInference("aliases", "alias1, alias2", false)).toBe(false);
    expect(await confirmInference("subdomain", "payments", false)).toBe(false);
  });
});
