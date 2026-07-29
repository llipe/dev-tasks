import { describe, it, expect } from "vitest";
import { ExitCode } from "#core/exit-codes.js";

describe("exit-codes", () => {
  it("exports all 15 exit codes (0-14)", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    expect(values).toHaveLength(15);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(14);
  });

  it("has correct named values per spec §6.7", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.InvalidUsage).toBe(2);
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
    expect(ExitCode.ReconciliationConflict).toBe(14);
  });

  it("each code is unique", () => {
    const values = Object.values(ExitCode).filter((v) => typeof v === "number");
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
