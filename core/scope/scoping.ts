/**
 * LLM scoping orchestrator.
 *
 * Orchestrates: prompt assembly → LLM call → schema validation →
 * post-schema id validation → single repair retry → calibration recording.
 *
 * Exit 10 on second validation failure (invalid scope after retry).
 */

import type { CatalogIndex } from "../catalog/index-model.js";
import type { ResolveCandidate } from "../catalog/resolve.js";
import {
  buildScopingInput,
  serializeScopingInput,
  SCOPING_SYSTEM_PROMPT,
  REPAIR_PROMPT_PREFIX,
  REPAIR_PROMPT_SUFFIX,
} from "./prompt.js";
import { parseLlmResponse, validateScopeIds, validateScopeSchema } from "./validate.js";
import { buildCalibrationRecord, writeCalibrationRecord } from "./calibration.js";
import type { LlmScopeProvider, ScopeOutput } from "./types.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ScopingOptions {
  /** The task description text */
  taskText: string;
  /** Resolve results (candidates) */
  candidates: ResolveCandidate[];
  /** The catalog index */
  index: CatalogIndex;
  /** LLM provider for the scoping call */
  llmProvider: LlmScopeProvider;
  /** Base directory for calibration output (default: cwd) */
  baseDir?: string;
  /** If true, skip writing calibration data */
  skipCalibration?: boolean;
}

export interface ScopingSuccess {
  success: true;
  output: ScopeOutput;
  repairAttempted: boolean;
  calibrationPath?: string;
}

export interface ScopingFailure {
  success: false;
  errors: string[];
  repairAttempted: boolean;
}

export type ScopingResult = ScopingSuccess | ScopingFailure;

/* ─── Exit Code ───────────────────────────────────────────────────────── */

/** Exit code for invalid scope after retry (spec §8.2) */
export const EXIT_INVALID_SCOPE = 10;

/* ─── Orchestrator ────────────────────────────────────────────────────── */

/**
 * Run the LLM scoping step with schema-validated output and repair retry.
 *
 * Steps:
 * 1. Build constrained input (task, candidates, flows, domains)
 * 2. Call LLM with system prompt + input
 * 3. Parse and validate response (schema + id check)
 * 4. On failure: send repair prompt with error context → validate again
 * 5. Second failure → return failure result (caller exits 10)
 * 6. On success: record calibration data
 */
export async function runScoping(options: ScopingOptions): Promise<ScopingResult> {
  const { taskText, candidates, index, llmProvider, baseDir, skipCalibration } = options;

  // Build constrained input
  const scopingInput = buildScopingInput(taskText, candidates, index);
  const userInput = serializeScopingInput(scopingInput);

  // Compute valid id sets for post-schema validation
  const candidateIds = new Set(candidates.map((c) => c.id));
  const indexIds = new Set(index.components.map((c) => c.id));

  // First attempt
  const firstResponse = await llmProvider.scopeCall(SCOPING_SYSTEM_PROMPT, userInput);
  const firstValidation = validateResponse(firstResponse, candidateIds, indexIds);

  if (firstValidation.valid) {
    const calibrationPath = recordCalibration(
      firstValidation.output,
      taskText,
      baseDir,
      skipCalibration,
    );
    return {
      success: true,
      output: firstValidation.output,
      repairAttempted: false,
      calibrationPath,
    };
  }

  // Repair attempt: send error context back to LLM
  const repairMessage =
    REPAIR_PROMPT_PREFIX + firstValidation.errors.join("\n") + REPAIR_PROMPT_SUFFIX;
  const secondResponse = await llmProvider.scopeCall(
    SCOPING_SYSTEM_PROMPT,
    userInput + "\n\n" + repairMessage,
  );
  const secondValidation = validateResponse(secondResponse, candidateIds, indexIds);

  if (secondValidation.valid) {
    const calibrationPath = recordCalibration(
      secondValidation.output,
      taskText,
      baseDir,
      skipCalibration,
    );
    return {
      success: true,
      output: secondValidation.output,
      repairAttempted: true,
      calibrationPath,
    };
  }

  // Second failure → exit 10
  return {
    success: false,
    errors: secondValidation.errors,
    repairAttempted: true,
  };
}

/* ─── Internal ────────────────────────────────────────────────────────── */

interface ValidResponse {
  valid: true;
  output: ScopeOutput;
}

interface InvalidResponse {
  valid: false;
  errors: string[];
}

type ResponseValidation = ValidResponse | InvalidResponse;

/**
 * Parse, schema-validate, and id-validate a raw LLM response.
 */
function validateResponse(
  rawResponse: string,
  candidateIds: Set<string>,
  indexIds: Set<string>,
): ResponseValidation {
  // Step 1: Parse JSON
  const parseResult = parseLlmResponse(rawResponse);
  if ("error" in parseResult) {
    return { valid: false, errors: [parseResult.error] };
  }

  // Step 2: Schema validation
  const schemaResult = validateScopeSchema(parseResult.parsed);
  if (!schemaResult.valid) {
    return { valid: false, errors: schemaResult.errors };
  }

  // Step 3: Post-schema id validation
  const idResult = validateScopeIds(schemaResult.output, candidateIds, indexIds);
  if (!idResult.valid) {
    const errors = idResult.inventedIds.map(
      (id) => `Invented component id "${id}" is not in candidates or index`,
    );
    return { valid: false, errors };
  }

  return { valid: true, output: schemaResult.output };
}

/**
 * Record calibration data (if not skipped).
 */
function recordCalibration(
  output: ScopeOutput,
  taskText: string,
  baseDir?: string,
  skip?: boolean,
): string | undefined {
  if (skip) return undefined;
  const dir = baseDir ?? process.cwd();
  const record = buildCalibrationRecord(output, taskText);
  return writeCalibrationRecord(dir, record);
}
