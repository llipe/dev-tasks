/**
 * Local schema validator for catalog artifacts (component.json, flow, scope-output).
 * Spec: specification-multi-repo-context.md sections 4.6, 5, 6.2, 8.3.
 *
 * Validates entirely offline against the bundled JSON Schemas (draft 2020-12)
 * using ajv's Ajv2020 class. No network access; no remote $ref resolution.
 *
 * This module is reused by:
 * - `dt validate-component` (this story, S-010) — component.json only.
 * - `dt catalog validate` V01 check (S-012) — same component schema.
 */

import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { Ajv2020, type ValidateFunction, type ErrorObject } from "ajv/dist/2020.js";

export type ArtifactKind = "component" | "flow" | "scope-output";

const SCHEMA_FILENAMES: Record<ArtifactKind, string> = {
  component: "component.schema.json",
  flow: "flow.schema.json",
  "scope-output": "scope-output.schema.json",
};

/**
 * A single structured validation error, derived from an ajv ErrorObject.
 */
export interface ValidationErrorDetail {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

/**
 * Result of validating an artifact against its schema.
 */
export interface ValidateArtifactResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const compiledValidators = new Map<ArtifactKind, ValidateFunction>();

/**
 * Resolve the absolute path to a bundled schema file.
 * Walks up from this module's directory to find the package-level `schemas/` dir,
 * covering both source (`core/catalog/`) and compiled (`dist/core/catalog/`) layouts.
 */
export function resolveSchemaPath(kind: ArtifactKind): string {
  const filename = SCHEMA_FILENAMES[kind];
  let dir = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "schemas", filename);
    try {
      readFileSync(candidate, "utf-8");
      return candidate;
    } catch {
      // not found here, keep walking up
    }
    dir = resolve(dir, "..");
  }
  throw new Error(`Could not locate schema file: ${filename}`);
}

function loadSchema(kind: ArtifactKind): object {
  const path = resolveSchemaPath(kind);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as object;
}

function getValidator(kind: ArtifactKind): ValidateFunction {
  const cached = compiledValidators.get(kind);
  if (cached) return cached;

  const schema = loadSchema(kind);
  const validateFn = ajv.compile(schema);
  compiledValidators.set(kind, validateFn);
  return validateFn;
}

function toDetail(err: ErrorObject): ValidationErrorDetail {
  return {
    path: err.instancePath || "/",
    message: err.message ?? "validation error",
    keyword: err.keyword,
    params: err.params as Record<string, unknown>,
  };
}

/**
 * Validate an already-parsed artifact object against its schema.
 * No I/O — pure function, easy to unit test.
 */
export function validateArtifact(kind: ArtifactKind, data: unknown): ValidateArtifactResult {
  const validateFn = getValidator(kind);
  const valid = validateFn(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validateFn.errors ?? []).map(toDetail);
  return { valid: false, errors };
}

/**
 * Read and parse a JSON file, then validate it against the given artifact schema.
 * Throws only for I/O / JSON-parse failures — schema violations are reported
 * in the returned result, not thrown.
 */
export function validateArtifactFile(kind: ArtifactKind, filePath: string): ValidateArtifactResult {
  const absPath = resolve(filePath);
  const raw = readFileSync(absPath, "utf-8");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: [{ path: "/", message: `Invalid JSON: ${msg}`, keyword: "parse", params: {} }],
    };
  }
  return validateArtifact(kind, data);
}

/**
 * Convenience wrapper for the CLI: validate a component.json file.
 */
export function validateComponentFile(filePath: string): ValidateArtifactResult {
  return validateArtifactFile("component", filePath);
}
