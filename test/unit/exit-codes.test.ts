import { describe, it, expect } from "vitest";
import { ExitCode } from "#core/exit-codes.js";

describe("exit-codes", () => {
  it("exports 5 distinct exit code values used by the dev-tasks binary", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    const unique = new Set(values);
    expect(unique.size).toBe(5);
    expect(unique).toEqual(new Set([0, 1, 2, 11, 14]));
  });

  it("has correct named values retained after the dt retirement (ADR-007)", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.InvalidUsage).toBe(2);
    expect(ExitCode.DependencyError).toBe(11);
    expect(ExitCode.ReconciliationConflict).toBe(14);
  });

  it("does not export any dt-only code or legacy alias", () => {
    const removedNames = [
      "PartialCatalogBuild",
      "NetworkError",
      "CatalogValidationErrors",
      "AuthError",
      "FetchFailure",
      "NotFound",
      "InsufficientBudget",
      "Conflict",
      "GateAborted",
      "Timeout",
      "BreakingChange",
      "RateLimit",
      "StaleIndex",
      "ValidationError",
      "InvalidScoping",
      "ConfigurationError",
      "NoCandidates",
      "UnknownComponent",
      "PermissionDenied",
      "IncompleteExtraction",
      "MissingRequiredField",
    ];
    for (const name of removedNames) {
      expect(Object.prototype.hasOwnProperty.call(ExitCode, name)).toBe(false);
    }
  });

  it("each retained value maps to the correct range", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(14);
    }
  });
});
