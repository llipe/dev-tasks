/**
 * Schema validation and post-schema id validation for scope output.
 *
 * - Validates LLM output against scope-output.schema.json
 * - Rejects any component id not present in candidates or full index
 */

import { Ajv2020, type ValidateFunction, type ErrorObject } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { ScopeOutput } from "./types.js";

/* ─── Schema Loading ──────────────────────────────────────────────────── */

const __dirname = dirname(fileURLToPath(import.meta.url));

const ajv = new Ajv2020({ allErrors: true });
let _validator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (!_validator) {
    const schemaPath = resolve(__dirname, "../../schemas/scope-output.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as object;
    _validator = ajv.compile(schema);
  }
  return _validator;
}

/* ─── Validation Result ───────────────────────────────────────────────── */

export interface ValidationSuccess {
  valid: true;
  output: ScopeOutput;
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/* ─── Schema Validation ───────────────────────────────────────────────── */

/**
 * Validate raw parsed JSON against scope-output.schema.json.
 * Returns structured validation result.
 */
export function validateScopeSchema(data: unknown): ValidationResult {
  const validate = getValidator();
  const isValid = validate(data);

  if (!isValid) {
    const errors = (validate.errors ?? []).map((e: ErrorObject) => {
      const path = e.instancePath || "/";
      const msg = e.message ?? "unknown error";
      return `${path}: ${msg}`;
    });
    return { valid: false, errors };
  }

  return { valid: true, output: data as ScopeOutput };
}

/* ─── Post-Schema ID Validation ───────────────────────────────────────── */

export interface IdValidationSuccess {
  valid: true;
}

export interface IdValidationFailure {
  valid: false;
  inventedIds: string[];
}

export type IdValidationResult = IdValidationSuccess | IdValidationFailure;

/**
 * Validate that all component ids in the scope output exist in either:
 * 1. The candidates list (from resolve), OR
 * 2. The full index (all known component ids)
 *
 * Any id found in neither is considered "invented" and must trigger repair.
 */
export function validateScopeIds(
  output: ScopeOutput,
  candidateIds: Set<string>,
  indexIds: Set<string>,
): IdValidationResult {
  const allValidIds = new Set([...candidateIds, ...indexIds]);
  const inventedIds: string[] = [];

  for (const id of output.primary) {
    if (!allValidIds.has(id)) {
      inventedIds.push(id);
    }
  }

  for (const id of output.secondary) {
    if (!allValidIds.has(id)) {
      inventedIds.push(id);
    }
  }

  if (inventedIds.length > 0) {
    return { valid: false, inventedIds };
  }

  return { valid: true };
}

/**
 * Parse raw LLM response string into a JSON object.
 * Handles responses that may include markdown fences or extra whitespace.
 */
export function parseLlmResponse(response: string): { parsed: unknown } | { error: string } {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return { parsed: JSON.parse(cleaned) };
  } catch {
    return { error: `Response is not valid JSON: ${cleaned.slice(0, 200)}` };
  }
}
