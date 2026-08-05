/**
 * Gate rules G1-G7 for scope validation.
 *
 * Gates are classified as:
 * - Abort gates (G1-G4): fail the pipeline, exit 7
 * - Review gates (G5-G7): continue with review_flags
 *
 * Spec §8.3 / RF-34, RF-35, RF-40, RF-41.
 */

import type { CatalogIndex } from "../catalog/index-model.js";
import type { ScopeOutput } from "./types.js";
import type { ClosureResult } from "./closure.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface GateOptions {
  /** Maximum total components (primary + secondary) before G1 abort. Default: 4. */
  maxComponents?: number;
}

export interface GateViolation {
  rule: string;
  message: string;
}

export interface GateSuccess {
  passed: true;
  reviewFlags: GateViolation[];
}

export interface GateAbort {
  passed: false;
  abortReason: string;
  abortRule: string;
  reviewFlags: GateViolation[];
}

export type GateResult = GateSuccess | GateAbort;

/* ─── Constants ───────────────────────────────────────────────────────── */

const DEFAULT_MAX_COMPONENTS = 4;

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Run all gate rules G1-G7 against the expanded scope.
 *
 * Abort gates (G1-G4) are checked first. If any abort gate triggers, the
 * pipeline stops immediately.
 *
 * Review gates (G5-G7) are accumulated as review_flags.
 */
export function runGate(
  scopeOutput: ScopeOutput,
  closureResult: ClosureResult,
  index: CatalogIndex,
  options: GateOptions = {},
): GateResult {
  const maxComponents = options.maxComponents ?? DEFAULT_MAX_COMPONENTS;
  const reviewFlags: GateViolation[] = [];

  // ─── Abort Gates (G1-G4) ─────────────────────────────────────────

  // G1: total components > maxComponents → abort
  const totalComponents = closureResult.primary.length + closureResult.secondary.length;
  if (totalComponents > maxComponents) {
    return {
      passed: false,
      abortReason: `Total components (${totalComponents}) exceeds maximum (${maxComponents}). Consider splitting the task.`,
      abortRule: "G1",
      reviewFlags,
    };
  }

  // G2: confidence: low → abort
  if (scopeOutput.confidence === "low") {
    return {
      passed: false,
      abortReason: `Scope confidence is "low" — the task may be ambiguous or too broad.`,
      abortRule: "G2",
      reviewFlags,
    };
  }

  // G3: non-empty unresolved → abort
  if (scopeOutput.unresolved.length > 0) {
    return {
      passed: false,
      abortReason: `Unresolved capabilities: ${scopeOutput.unresolved.join(", ")}. Cannot proceed with unmapped scope.`,
      abortRule: "G3",
      reviewFlags,
    };
  }

  // G4: component in scope without component.json in catalog → abort
  const allScopeIds = [...closureResult.primary, ...closureResult.secondary];
  for (const id of allScopeIds) {
    const comp = index.components.find((c) => c.id === id);
    if (!comp) {
      return {
        passed: false,
        abortReason: `Component "${id}" is in scope but has no entry in the catalog index.`,
        abortRule: "G4",
        reviewFlags,
      };
    }
  }

  // ─── Review Gates (G5-G7) ────────────────────────────────────────

  // G5: LLM-selected component absent from candidates+closure (RF-40)
  // A component selected by the LLM that was not in the original candidates
  // and also not added by closure. This is a soft signal — may be valid but unusual.
  const closureSourceMap = closureResult.sourceMap;
  for (const id of scopeOutput.primary) {
    if (closureSourceMap[id] === "llm") {
      // Check if this component was only in the LLM output but not reachable via closure
      // We flag if the component is not a neighbor of any other scope member
      const isIsolated = isComponentIsolated(id, closureResult, index);
      if (isIsolated) {
        reviewFlags.push({
          rule: "G5",
          message: `Primary component "${id}" is not reachable via graph closure from other scope members. Verify its inclusion is intentional.`,
        });
      }
    }
  }

  // G6: scope spans >2 domains
  const domains = getUniqueDomains(allScopeIds, index);
  if (domains.size > 2) {
    reviewFlags.push({
      rule: "G6",
      message: `Scope spans ${domains.size} domains (${[...domains].join(", ")}). Cross-domain changes increase coordination risk.`,
    });
  }

  // G7: boundary contract has payload_confidence: low (RF-41)
  for (const contractId of scopeOutput.contracts_crossed) {
    const contractEntry = index.contracts[contractId];
    if (!contractEntry) continue;

    // Look up the provider's provides entry for this contract
    const provider = index.components.find((c) => c.id === contractEntry.provider);
    if (!provider) continue;

    const providesEntry = provider.provides.find((p) => p.id === contractId);
    if (providesEntry && providesEntry.payload_confidence === "low") {
      reviewFlags.push({
        rule: "G7",
        message: `Boundary contract "${contractId}" has payload_confidence: low. Breaking-change detection may produce false positives.`,
      });
    }
  }

  return { passed: true, reviewFlags };
}

/* ─── Internal Helpers ────────────────────────────────────────────────── */

/**
 * Check if a component is isolated (not a graph neighbor of any other scope member).
 * Used for G5 detection.
 */
function isComponentIsolated(
  componentId: string,
  closureResult: ClosureResult,
  index: CatalogIndex,
): boolean {
  const otherScope = [
    ...closureResult.primary.filter((id) => id !== componentId),
    ...closureResult.secondary,
  ];

  if (otherScope.length === 0) return false; // single component, not isolated by definition

  const comp = index.components.find((c) => c.id === componentId);
  if (!comp) return true;

  // Check if this component shares any contracts with scope members
  // (either as provider or consumer)
  for (const otherId of otherScope) {
    const other = index.components.find((c) => c.id === otherId);
    if (!other) continue;

    // Check if comp provides something other consumes
    for (const p of comp.provides) {
      if (other.consumes.some((c) => c.contract === p.id)) return false;
    }
    // Check if comp consumes something other provides
    for (const c of comp.consumes) {
      if (other.provides.some((p) => p.id === c.contract)) return false;
    }
  }

  // Check if they share a flow
  for (const flow of index.flows) {
    if (
      flow.participants.includes(componentId) &&
      flow.participants.some((p) => otherScope.includes(p))
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get unique domains for a set of component ids.
 */
function getUniqueDomains(componentIds: string[], index: CatalogIndex): Set<string> {
  const domains = new Set<string>();
  for (const id of componentIds) {
    const comp = index.components.find((c) => c.id === id);
    if (comp) {
      domains.add(comp.domain);
    }
  }
  return domains;
}
