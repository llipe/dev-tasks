import { describe, it, expect } from "vitest";
import { ExitCode } from "#core/exit-codes.js";

describe("exit-codes", () => {
  it("exports 15 distinct exit code values (0-14)", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    const unique = new Set(values);
    // 15 distinct values covering 0-14
    expect(unique.size).toBe(15);
    expect(Math.min(...unique)).toBe(0);
    expect(Math.max(...unique)).toBe(14);
  });

  it("has correct named values per spec §6.7", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.InvalidUsage).toBe(2);
    expect(ExitCode.PartialCatalogBuild).toBe(3);
    expect(ExitCode.CatalogValidationErrors).toBe(4);
    expect(ExitCode.FetchFailure).toBe(5);
    expect(ExitCode.InsufficientBudget).toBe(6);
    expect(ExitCode.GateAborted).toBe(7);
    expect(ExitCode.BreakingChange).toBe(8);
    expect(ExitCode.StaleIndex).toBe(9);
    expect(ExitCode.InvalidScoping).toBe(10);
    expect(ExitCode.NoCandidates).toBe(11);
    expect(ExitCode.UnknownComponent).toBe(12);
    expect(ExitCode.IncompleteExtraction).toBe(13);
    expect(ExitCode.ReconciliationConflict).toBe(14);
  });

  it("preserves legacy aliases for backward compatibility", () => {
    expect(ExitCode.NetworkError).toBe(3);
    expect(ExitCode.AuthError).toBe(4);
    expect(ExitCode.NotFound).toBe(5);
    expect(ExitCode.Conflict).toBe(6);
    expect(ExitCode.Timeout).toBe(7);
    expect(ExitCode.RateLimit).toBe(8);
    expect(ExitCode.ValidationError).toBe(9);
    expect(ExitCode.ConfigurationError).toBe(10);
    expect(ExitCode.DependencyError).toBe(11);
    expect(ExitCode.PermissionDenied).toBe(12);
    expect(ExitCode.MissingRequiredField).toBe(13);
  });

  it("each distinct value maps to the correct range", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(14);
    }
  });
});
