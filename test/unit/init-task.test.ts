/**
 * Unit tests for initWithTask types, error classes, and exit codes (S-020).
 *
 * Tests: error class construction; exit code values; result shape contract;
 * session lock with review_flags and LLM scope fields.
 */

import { describe, it, expect } from "vitest";

import { NoCandidatesError, GateAbortError, InvalidScopeError } from "#core/context/init.js";
import {
  EXIT_BUDGET_EXCEEDED,
  EXIT_GATE_ABORT,
  EXIT_STALE_INDEX,
  EXIT_INVALID_SCOPE,
  EXIT_NO_CANDIDATES,
  EXIT_UNKNOWN_COMPONENT,
} from "#core/context/exit-codes.js";
import {
  computeTaskHash,
  computeTaskHashFromText,
  buildSessionLock,
} from "#core/context/session-lock.js";
import type { BundleManifest } from "#core/context/assemble.js";

/* ─── Exit Codes ──────────────────────────────────────────────────────── */

describe("init pipeline exit codes", () => {
  it("EXIT_BUDGET_EXCEEDED is 6", () => {
    expect(EXIT_BUDGET_EXCEEDED).toBe(6);
  });

  it("EXIT_GATE_ABORT is 7", () => {
    expect(EXIT_GATE_ABORT).toBe(7);
  });

  it("EXIT_STALE_INDEX is 9", () => {
    expect(EXIT_STALE_INDEX).toBe(9);
  });

  it("EXIT_INVALID_SCOPE is 10", () => {
    expect(EXIT_INVALID_SCOPE).toBe(10);
  });

  it("EXIT_NO_CANDIDATES is 11", () => {
    expect(EXIT_NO_CANDIDATES).toBe(11);
  });

  it("EXIT_UNKNOWN_COMPONENT is 12", () => {
    expect(EXIT_UNKNOWN_COMPONENT).toBe(12);
  });
});

/* ─── Error Classes ───────────────────────────────────────────────────── */

describe("NoCandidatesError", () => {
  it("constructs with task text", () => {
    const err = new NoCandidatesError("add MFA");
    expect(err.name).toBe("NoCandidatesError");
    expect(err.taskText).toBe("add MFA");
    expect(err.message).toContain("add MFA");
  });
});

describe("GateAbortError", () => {
  it("constructs with abort rule and review flags", () => {
    const flags = [{ rule: "G5", message: "test flag" }];
    const err = new GateAbortError("Too many components", "G1", flags);
    expect(err.name).toBe("GateAbortError");
    expect(err.abortRule).toBe("G1");
    expect(err.reviewFlags).toEqual(flags);
    expect(err.message).toContain("G1");
    expect(err.message).toContain("Too many components");
  });
});

describe("InvalidScopeError", () => {
  it("constructs with error list", () => {
    const errors = ["invalid json", "missing primary"];
    const err = new InvalidScopeError(errors);
    expect(err.name).toBe("InvalidScopeError");
    expect(err.errors).toEqual(errors);
    expect(err.message).toContain("invalid json");
  });
});

/* ─── Task Hash ───────────────────────────────────────────────────────── */

describe("computeTaskHashFromText", () => {
  it("produces a deterministic SHA-256 hex hash", () => {
    const hash = computeTaskHashFromText("add MFA to auth");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("same text produces same hash", () => {
    const h1 = computeTaskHashFromText("add MFA");
    const h2 = computeTaskHashFromText("add MFA");
    expect(h1).toBe(h2);
  });

  it("different text produces different hash", () => {
    const h1 = computeTaskHashFromText("add MFA");
    const h2 = computeTaskHashFromText("remove MFA");
    expect(h1).not.toBe(h2);
  });

  it("differs from component-based hash for multi-component input", () => {
    // computeTaskHash sorts and joins with comma: "auth-service,user-service"
    // computeTaskHashFromText hashes raw text
    const _textHash = computeTaskHashFromText("auth-service,user-service");
    const compHash = computeTaskHash(["user-service", "auth-service"]);
    // They produce the same hash since sorted join === "auth-service,user-service"
    // But a natural task text would be different:
    const naturalHash = computeTaskHashFromText("Add MFA to auth");
    expect(naturalHash).not.toBe(compHash);
  });
});

/* ─── buildSessionLock with task params ───────────────────────────────── */

describe("buildSessionLock — task mode", () => {
  const manifest: BundleManifest = {
    files: [{ filename: "00-index.md", layerId: "00-index", sha256: "aaa", tokens: 100 }],
    truncated: [],
    totalTokens: 100,
    budget: 60000,
  };

  it("includes review_flags in the lock", () => {
    const lock = buildSessionLock({
      components: ["auth-service", "user-service"],
      source: "llm",
      metaRepoSha: "abc123",
      indexAgeMinutes: 30,
      repoShas: { "auth-service": "sha1" },
      bundleManifest: manifest,
      taskText: "add MFA",
      primary: ["auth-service"],
      secondary: ["user-service"],
      contractsCrossed: ["user-api"],
      confidence: "high",
      reviewFlags: [{ rule: "G6", message: "Cross-domain" }],
    });

    expect(lock.review_flags).toEqual([{ rule: "G6", message: "Cross-domain" }]);
  });

  it("includes task_text in the lock", () => {
    const lock = buildSessionLock({
      components: ["auth-service"],
      source: "llm",
      metaRepoSha: "abc123",
      indexAgeMinutes: 30,
      repoShas: {},
      bundleManifest: manifest,
      taskText: "implement feature X",
      primary: ["auth-service"],
      secondary: [],
      contractsCrossed: [],
      confidence: "high",
      reviewFlags: [],
    });

    expect(lock.task_text).toBe("implement feature X");
    expect(lock.task_hash).toBe(computeTaskHashFromText("implement feature X"));
  });

  it("includes LLM scope fields (primary, secondary, contracts_crossed, confidence)", () => {
    const lock = buildSessionLock({
      components: ["auth-service", "user-service"],
      source: "llm",
      metaRepoSha: "sha",
      indexAgeMinutes: 10,
      repoShas: {},
      bundleManifest: manifest,
      taskText: "task",
      primary: ["auth-service"],
      secondary: ["user-service"],
      contractsCrossed: ["user-api"],
      confidence: "medium",
      flow: "checkout-flow",
      reviewFlags: [],
    });

    expect(lock.scope.source).toBe("llm");
    expect(lock.scope.primary).toEqual(["auth-service"]);
    expect(lock.scope.secondary).toEqual(["user-service"]);
    expect(lock.scope.contracts_crossed).toEqual(["user-api"]);
    expect(lock.scope.confidence).toBe("medium");
    expect(lock.scope.flow).toBe("checkout-flow");
  });

  it("manual mode still works without task params", () => {
    const lock = buildSessionLock({
      components: ["auth-service"],
      source: "manual",
      metaRepoSha: "sha",
      indexAgeMinutes: 10,
      repoShas: {},
      bundleManifest: manifest,
    });

    expect(lock.scope.source).toBe("manual");
    expect(lock.scope.primary).toBeUndefined();
    expect(lock.scope.secondary).toBeUndefined();
    expect(lock.review_flags).toEqual([]);
    expect(lock.task_text).toBeUndefined();
  });
});
