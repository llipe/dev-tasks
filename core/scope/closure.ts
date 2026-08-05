/**
 * Graph closure expansion for scope output.
 *
 * Adds `contracts_crossed` consumers and flow neighbors to `secondary`.
 * Deduplicates (primary wins over secondary).
 * Records `scope.source` per component (`llm` or `closure`).
 *
 * Spec §6.4 / RF-34.
 */

import type { CatalogIndex } from "../catalog/index-model.js";
import type { ScopeOutput } from "./types.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export type ScopeSource = "llm" | "closure";

export interface ScopeSourceMap {
  [componentId: string]: ScopeSource;
}

export interface ClosureResult {
  /** Final primary components (unchanged from LLM output) */
  primary: string[];
  /** Final secondary components (LLM secondary + closure additions, deduplicated) */
  secondary: string[];
  /** Source attribution per component */
  sourceMap: ScopeSourceMap;
}

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Expand scope via graph closure:
 * 1. Add consumers of `contracts_crossed` to secondary
 * 2. Add flow neighbors (if `flow` specified) to secondary
 * 3. Deduplicate: primary wins over secondary; no duplicates in secondary
 */
export function expandClosure(scopeOutput: ScopeOutput, index: CatalogIndex): ClosureResult {
  const primarySet = new Set(scopeOutput.primary);
  const secondarySet = new Set(scopeOutput.secondary);

  // Build source map — LLM selections first
  const sourceMap: ScopeSourceMap = {};
  for (const id of scopeOutput.primary) {
    sourceMap[id] = "llm";
  }
  for (const id of scopeOutput.secondary) {
    sourceMap[id] = "llm";
  }

  // Step 1: Add consumers of contracts_crossed
  for (const contractId of scopeOutput.contracts_crossed) {
    const contractEntry = index.contracts[contractId];
    if (!contractEntry) continue;

    for (const consumerId of contractEntry.consumers) {
      if (!primarySet.has(consumerId) && !secondarySet.has(consumerId)) {
        secondarySet.add(consumerId);
        sourceMap[consumerId] = "closure";
      }
    }

    // Also add the provider if not already in scope
    const providerId = contractEntry.provider;
    if (!primarySet.has(providerId) && !secondarySet.has(providerId)) {
      secondarySet.add(providerId);
      sourceMap[providerId] = "closure";
    }
  }

  // Step 2: Add flow neighbors if flow is specified
  if (scopeOutput.flow) {
    const flowEntry = index.flows.find((f) => f.id === scopeOutput.flow);
    if (flowEntry) {
      for (const participantId of flowEntry.participants) {
        if (!primarySet.has(participantId) && !secondarySet.has(participantId)) {
          // Verify the participant exists in the index
          const exists = index.components.some((c) => c.id === participantId);
          if (exists) {
            secondarySet.add(participantId);
            sourceMap[participantId] = "closure";
          }
        }
      }
    }
  }

  return {
    primary: [...primarySet],
    secondary: [...secondarySet],
    sourceMap,
  };
}
