/**
 * OpenAPI extraction module barrel export and ladder orchestrator.
 */

export type {
  ExtractedEndpoint,
  OpenApiConfidence,
  OpenApiDocument,
  OpenApiExtractionResult,
  OpenApiSource,
  RequestBodySchema,
  ResponseSchema,
  RouteParam,
  UnresolvedRoute,
} from "./types.js";

export { extractRoute1, detectOnDiskSpec, normalizeSpec, Route1Error } from "./route1.js";
export { extractRoute3, composePath, extractPathParams } from "./route3.js";
export { extractRoute2, extractRoute2Express } from "./route2.js";
export type { Route2Config, Route2Extractor, Route2Options } from "./route2.js";
export { validateOpenApi, extractionResultToDocument } from "./validate.js";
export type { ValidationResult, ValidationError } from "./validate.js";

// --- Ladder orchestrator ---

import { runLadder, type Rung, type LadderResult } from "../ladder.js";
import type { OpenApiExtractionResult } from "./types.js";
import { extractRoute1 } from "./route1.js";
import { extractRoute2Express } from "./route2.js";
import { extractRoute3 } from "./route3.js";

/**
 * Options for the OpenAPI ladder extraction.
 */
export interface OpenApiLadderOptions {
  /** Root directory of the project */
  rootDir: string;
  /** Override entry point for route2 boot */
  entry?: string;
  /** Skip the observed (boot) rung */
  noBoot?: boolean;
  /** Timeout for boot in ms (default: 10000) */
  bootTimeout?: number;
}

/**
 * Result from the OpenAPI ladder extraction.
 */
export interface OpenApiLadderResult {
  /** The extraction result (null if all rungs failed) */
  extraction: OpenApiExtractionResult | null;
  /** Ladder metadata */
  ladder: LadderResult<OpenApiExtractionResult>;
}

/**
 * Run the OpenAPI extraction ladder: declared → observed → inferred.
 *
 * 1. Declared (route1): Look for on-disk OpenAPI spec
 * 2. Observed (route2): Boot the app and introspect the router
 * 3. Inferred (route3): AST analysis (always low confidence)
 */
export async function extractOpenApiLadder(
  options: OpenApiLadderOptions,
): Promise<OpenApiLadderResult> {
  const { rootDir, entry, noBoot, bootTimeout } = options;

  const rungs: Rung<OpenApiExtractionResult>[] = [
    // Rung 1: Declared — on-disk spec
    {
      kind: "declared",
      name: "route1-on-disk-spec",
      execute: () => {
        try {
          const result = extractRoute1(rootDir);
          return { result, diagnostics: result ? [] : ["No on-disk OpenAPI spec found"] };
        } catch (err) {
          return {
            result: null,
            diagnostics: [`route1 failed: ${err instanceof Error ? err.message : String(err)}`],
          };
        }
      },
    },
  ];

  // Rung 2: Observed — boot + introspect (skip if --no-boot)
  if (!noBoot) {
    rungs.push({
      kind: "observed",
      name: "route2-boot-introspect",
      execute: () => {
        // Route2 is async but ladder is sync — we need a sync wrapper.
        // This is handled by running the ladder async below.
        // Placeholder — will be replaced in async execution.
        return { result: null, diagnostics: ["route2 requires async execution"] };
      },
    });
  }

  // Rung 3: Inferred — AST analysis (always low confidence)
  rungs.push({
    kind: "inferred",
    name: "route3-ast-inference",
    execute: () => {
      try {
        const result = extractRoute3(rootDir);
        if (result.endpoints.length === 0) {
          return { result: null, diagnostics: ["route3 found no endpoints"] };
        }
        // Force confidence: low on all endpoints (ladder policy enforces this)
        const lowConfResult: OpenApiExtractionResult = {
          ...result,
          confidence: "low",
          endpoints: result.endpoints.map((e) => ({ ...e, confidence: "low" as const })),
        };
        return { result: lowConfResult, diagnostics: [] };
      } catch (err) {
        return {
          result: null,
          diagnostics: [`route3 failed: ${err instanceof Error ? err.message : String(err)}`],
        };
      }
    },
  });

  // Since route2 is async, we run a custom ladder that handles it.
  // First try route1 (sync)
  const route1Result = rungs[0].execute();
  if (route1Result.result) {
    const ladderResult: LadderResult<OpenApiExtractionResult> = {
      result: route1Result.result,
      winningRung: "declared",
      confidence: "high",
      provenance: { rung: "declared", name: "route1-on-disk-spec" },
      diagnostics: route1Result.diagnostics,
    };
    return { extraction: route1Result.result, ladder: ladderResult };
  }

  // Try route2 (async) if not skipped
  const allDiagnostics = [...route1Result.diagnostics];

  if (!noBoot) {
    try {
      const route2Result = await extractRoute2Express(rootDir, {
        entry,
        timeout: bootTimeout,
      });
      if (route2Result && route2Result.endpoints.length > 0) {
        const ladderResult: LadderResult<OpenApiExtractionResult> = {
          result: route2Result,
          winningRung: "observed",
          confidence: "high",
          provenance: { rung: "observed", name: "route2-boot-introspect" },
          diagnostics: allDiagnostics,
        };
        return { extraction: route2Result, ladder: ladderResult };
      }
      allDiagnostics.push("route2 returned no endpoints or null");
    } catch (err) {
      allDiagnostics.push(
        `route2 failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    allDiagnostics.push("route2 skipped (--no-boot)");
  }

  // Try route3 (sync) — inferred, always low confidence
  const route3Rung = rungs[rungs.length - 1];
  const route3Result = route3Rung.execute();
  allDiagnostics.push(...route3Result.diagnostics);

  if (route3Result.result) {
    const ladderResult: LadderResult<OpenApiExtractionResult> = {
      result: route3Result.result,
      winningRung: "inferred",
      confidence: "low",
      provenance: { rung: "inferred", name: "route3-ast-inference" },
      diagnostics: allDiagnostics,
    };
    return { extraction: route3Result.result, ladder: ladderResult };
  }

  // All failed
  const ladderResult: LadderResult<OpenApiExtractionResult> = {
    result: null,
    winningRung: null,
    confidence: "low",
    provenance: null,
    diagnostics: allDiagnostics,
  };
  return { extraction: null, ladder: ladderResult };
}
