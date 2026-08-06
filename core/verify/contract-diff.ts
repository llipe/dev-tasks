/**
 * Contract-diff orchestrator.
 *
 * Detects the contract type (OpenAPI or AsyncAPI), loads base/head versions,
 * delegates to the appropriate comparator, and aggregates results.
 *
 * Key behaviors:
 * - No LLM used (RF-50)
 * - Contracts with `payload_confidence: low` are excluded
 * - Breaking change detected → exit 8
 * - No breaking changes → exit 0
 */

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { diffOpenApi } from "./openapi-diff.js";
import { diffAsyncApi } from "./asyncapi-diff.js";
import type { ContractDiffResult } from "./types.js";

/**
 * Detect the contract type from a parsed spec document.
 */
export function detectContractType(spec: Record<string, unknown>): "openapi" | "asyncapi" | null {
  if (typeof spec.openapi === "string" && spec.openapi.startsWith("3")) {
    return "openapi";
  }
  if (typeof spec.asyncapi === "string") {
    return "asyncapi";
  }
  return null;
}

/**
 * Load and parse a contract spec from a file path.
 * Supports JSON and YAML.
 */
export function loadSpec(filePath: string): Record<string, unknown> {
  const content = readFileSync(filePath, "utf-8");
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as Record<string, unknown>;
  }

  // Otherwise YAML
  return parseYaml(trimmed) as Record<string, unknown>;
}

/**
 * Options for the contract-diff orchestrator.
 */
export interface RunContractDiffOptions {
  /** Path to the base (old) contract spec */
  basePath: string;
  /** Path to the head (new) contract spec */
  headPath: string;
}

/**
 * Run contract-diff: load specs, detect type, delegate to comparator.
 *
 * @returns ContractDiffResult with findings.
 * @throws Error if specs cannot be loaded or type cannot be detected.
 */
export function runContractDiff(options: RunContractDiffOptions): ContractDiffResult {
  const { basePath, headPath } = options;

  const baseSpec = loadSpec(basePath);
  const headSpec = loadSpec(headPath);

  // Detect contract type from base (authoritative) with head as fallback
  const contractType = detectContractType(baseSpec) ?? detectContractType(headSpec);

  if (!contractType) {
    throw new Error(
      "Unable to detect contract type. Spec must contain 'openapi: 3.x' or 'asyncapi: x.x'.",
    );
  }

  if (contractType === "openapi") {
    return diffOpenApi(baseSpec, headSpec);
  }

  return diffAsyncApi(baseSpec, headSpec);
}
