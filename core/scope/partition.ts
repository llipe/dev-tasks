/**
 * Partition proposal for G1 abort.
 *
 * Groups components by domain/boundary and orders producer-before-consumers.
 * Emitted as a suggested task split when scope is over-broad.
 *
 * Spec §8.3 / RF-35.
 */

import type { CatalogIndex } from "../catalog/index-model.js";
import type { ClosureResult } from "./closure.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface PartitionEntry {
  /** Suggested sub-task label */
  label: string;
  /** Component IDs in this partition */
  components: string[];
  /** Domain of the partition */
  domain: string;
  /** Ordering priority (lower = earlier). Producers get lower numbers. */
  order: number;
}

export interface PartitionProposal {
  /** Ordered list of partition entries (producer-first) */
  partitions: PartitionEntry[];
  /** Reasoning for the split */
  rationale: string;
}

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Generate a partition proposal for an over-broad scope.
 *
 * Strategy:
 * 1. Group components by domain
 * 2. Within each domain group, identify producers and consumers
 * 3. Order: producers first (components that provide contracts consumed by others in scope)
 */
export function buildPartitionProposal(
  closureResult: ClosureResult,
  index: CatalogIndex,
): PartitionProposal {
  const allIds = [...closureResult.primary, ...closureResult.secondary];
  const allIdsSet = new Set(allIds);

  // Group by domain
  const domainGroups = new Map<string, string[]>();
  for (const id of allIds) {
    const comp = index.components.find((c) => c.id === id);
    if (!comp) continue;
    const domain = comp.domain;
    if (!domainGroups.has(domain)) {
      domainGroups.set(domain, []);
    }
    domainGroups.get(domain)!.push(id);
  }

  // Compute producer score: how many in-scope components consume from this component
  const producerScore = new Map<string, number>();
  for (const id of allIds) {
    const comp = index.components.find((c) => c.id === id);
    if (!comp) continue;

    let score = 0;
    for (const provides of comp.provides) {
      // Count how many in-scope components consume this contract
      const consumers = index.contracts[provides.id]?.consumers ?? [];
      score += consumers.filter((c) => allIdsSet.has(c) && c !== id).length;
    }
    producerScore.set(id, score);
  }

  // Build partitions ordered by domain, producers first within each domain
  const partitions: PartitionEntry[] = [];
  let orderCounter = 0;

  // Sort domains: domains with higher aggregate producer scores come first
  const domainOrder = [...domainGroups.entries()].sort((a, b) => {
    const scoreA = a[1].reduce((sum, id) => sum + (producerScore.get(id) ?? 0), 0);
    const scoreB = b[1].reduce((sum, id) => sum + (producerScore.get(id) ?? 0), 0);
    return scoreB - scoreA; // Higher producer score → earlier
  });

  for (const [domain, components] of domainOrder) {
    // Sort within domain: producers first (higher score = earlier)
    const sorted = [...components].sort((a, b) => {
      return (producerScore.get(b) ?? 0) - (producerScore.get(a) ?? 0);
    });

    partitions.push({
      label: `${domain}: ${sorted.join(", ")}`,
      components: sorted,
      domain,
      order: orderCounter++,
    });
  }

  const rationale = buildRationale(partitions, allIds.length);

  return { partitions, rationale };
}

/* ─── Internal ────────────────────────────────────────────────────────── */

function buildRationale(partitions: PartitionEntry[], totalComponents: number): string {
  if (partitions.length === 1) {
    return `Scope contains ${totalComponents} components in a single domain. Consider breaking into smaller tasks within the domain, implementing producers before consumers.`;
  }
  return `Scope spans ${partitions.length} domains with ${totalComponents} total components. Suggested split: implement each domain group as a separate task, starting with producer domains.`;
}
