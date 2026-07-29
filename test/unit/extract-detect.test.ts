import { describe, it, expect, beforeEach } from "vitest";
import {
  runDetection,
  registerProvider,
  clearProviders,
  getRequiresHuman,
} from "#core/extract/detect.js";
import type {
  ExtractionProvider,
  DetectionResult,
  RepoContext,
  RequiresHumanEntry,
} from "#core/extract/provider.js";

function makeProvider(id: string, result: DetectionResult | null): ExtractionProvider {
  return {
    id,
    capabilities: ["openapi_ast", "orm_ast"],
    detect(_repo: RepoContext): DetectionResult | null {
      return result;
    },
  };
}

describe("extract/detect orchestrator", () => {
  beforeEach(() => {
    clearProviders();
  });

  it("returns null when no providers are registered", () => {
    const result = runDetection({ rootDir: "/tmp/empty" });
    expect(result).toBeNull();
  });

  it("returns null when no provider matches", () => {
    registerProvider(makeProvider("no-match", null));
    const result = runDetection({ rootDir: "/tmp/empty" });
    expect(result).toBeNull();
  });

  it("returns the first matching provider result", () => {
    const detection: DetectionResult = {
      stack: ["node", "typescript"],
      http: null,
      orm: null,
      messaging: null,
      type_hint: "node-ts",
    };
    registerProvider(makeProvider("first", detection));
    registerProvider(makeProvider("second", null));

    const result = runDetection({ rootDir: "/tmp/repo" });
    expect(result).toEqual(detection);
  });

  it("skips non-matching providers and returns the first match", () => {
    const detection: DetectionResult = {
      stack: ["node", "typescript", "express"],
      http: {
        framework: "express",
        openapi_strategy: "route3",
        strategy_counts: { route1: 0, route2: 0, route3: 5 },
        evidence: [{ signal: "express", location: "package.json" }],
      },
      orm: null,
      messaging: null,
      type_hint: "node-express",
    };
    registerProvider(makeProvider("skip-me", null));
    registerProvider(makeProvider("match-me", detection));

    const result = runDetection({ rootDir: "/tmp/repo" });
    expect(result).toEqual(detection);
  });

  it("handles missing capability by recording requires_human", () => {
    const provider: ExtractionProvider = {
      id: "limited-provider",
      capabilities: ["openapi_ast"], // missing orm_ast, topic_ast
      detect(_repo: RepoContext): DetectionResult | null {
        return {
          stack: ["node"],
          http: {
            framework: "express",
            openapi_strategy: "route3",
            strategy_counts: { route1: 0, route2: 0, route3: 3 },
            evidence: [{ signal: "express", location: "package.json" }],
          },
          orm: null,
          messaging: null,
          type_hint: "node-express",
        };
      },
    };
    registerProvider(provider);

    const result = runDetection({ rootDir: "/tmp/repo" });
    expect(result).not.toBeNull();

    // Test the requires_human helper
    const requiredCapabilities: RequiresHumanEntry[] = getRequiresHuman(provider, [
      "orm_ast",
      "topic_ast",
    ]);
    expect(requiredCapabilities).toHaveLength(2);
    expect(requiredCapabilities[0].missing_capability).toBe("orm_ast");
    expect(requiredCapabilities[1].missing_capability).toBe("topic_ast");
  });

  it("does not fail when a provider lacks a capability", () => {
    const provider: ExtractionProvider = {
      id: "no-schema-provider",
      capabilities: ["openapi_ast"], // no orm_ast
      detect(_repo: RepoContext): DetectionResult | null {
        return {
          stack: ["node"],
          http: null,
          orm: null,
          messaging: null,
          type_hint: "node",
        };
      },
      // extractSchema not defined — this is valid
    };
    registerProvider(provider);

    // Should not throw
    expect(() => runDetection({ rootDir: "/tmp/repo" })).not.toThrow();
    const result = runDetection({ rootDir: "/tmp/repo" });
    expect(result).not.toBeNull();
  });
});
