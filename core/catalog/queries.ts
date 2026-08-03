/**
 * Graph reads for catalog queries: get, deps, consumers, flow, closure.
 * Reuses graph utilities from graph.ts.
 *
 * Spec: Issue #46 AC2.
 */

import type { CatalogIndex, ComponentSummary, FlowEntry } from "./index-model.js";
import { buildGraph, type CatalogGraph } from "./graph.js";

/* ─── Types ────────────────────────────────────────────────────────── */

export type DepsDirection = "up" | "down" | "both";

export interface DepsOptions {
  depth?: number;
  direction?: DepsDirection;
}

export interface ClosureOptions {
  includeConsumers?: boolean;
  max?: number;
}

export interface DepsResult {
  id: string;
  dependencies: ComponentSummary[];
}

export interface ConsumersResult {
  contract: string;
  provider: string;
  consumers: ComponentSummary[];
}

export interface FlowResult {
  flow: FlowEntry;
  components: ComponentSummary[];
}

export interface ClosureResult {
  roots: string[];
  components: ComponentSummary[];
  deduplicated: number;
  capped: boolean;
}

/* ─── Get ──────────────────────────────────────────────────────────── */

/**
 * Return the full component summary by id.
 * Returns null if not found.
 */
export function catalogGet(index: CatalogIndex, id: string): ComponentSummary | null {
  return index.components.find((c) => c.id === id) ?? null;
}

/* ─── Deps ─────────────────────────────────────────────────────────── */

/**
 * Traverse dependencies from a given component id.
 *
 * - direction "down": what this component depends on (consumes → provides direction)
 * - direction "up": what depends on this component (reverse edges)
 * - direction "both": union of both
 *
 * Respects depth limit (BFS level). Default depth = Infinity.
 */
export function catalogDeps(
  index: CatalogIndex,
  id: string,
  options: DepsOptions = {},
): DepsResult | null {
  const { depth = Infinity, direction = "down" } = options;

  const component = index.components.find((c) => c.id === id);
  if (!component) return null;

  const graph = buildGraph(index);
  const visited = new Set<string>();
  visited.add(id);

  const result: ComponentSummary[] = [];

  // BFS traversal
  let frontier = [id];
  let currentDepth = 0;

  while (frontier.length > 0 && currentDepth < depth) {
    const nextFrontier: string[] = [];

    for (const nodeId of frontier) {
      const neighbors = getNeighbors(graph, nodeId, direction);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          nextFrontier.push(neighborId);
          const comp = index.components.find((c) => c.id === neighborId);
          if (comp) result.push(comp);
        }
      }
    }

    frontier = nextFrontier;
    currentDepth++;
  }

  return { id, dependencies: result };
}

function getNeighbors(graph: CatalogGraph, nodeId: string, direction: DepsDirection): string[] {
  const neighbors: string[] = [];

  if (direction === "down" || direction === "both") {
    const outEdges = graph.edges.get(nodeId) ?? [];
    for (const edge of outEdges) {
      neighbors.push(edge.to);
    }
  }

  if (direction === "up" || direction === "both") {
    const inEdges = graph.reverseEdges.get(nodeId) ?? [];
    for (const edge of inEdges) {
      neighbors.push(edge.from);
    }
  }

  return neighbors;
}

/* ─── Consumers ────────────────────────────────────────────────────── */

/**
 * Return all components that consume a given contract.
 * Uses the contracts map (inverted consumer index) from the catalog.
 */
export function catalogConsumers(index: CatalogIndex, contractId: string): ConsumersResult | null {
  const entry = index.contracts[contractId];
  if (!entry) return null;

  const consumers: ComponentSummary[] = [];
  for (const consumerId of entry.consumers) {
    const comp = index.components.find((c) => c.id === consumerId);
    if (comp) consumers.push(comp);
  }

  return {
    contract: contractId,
    provider: entry.provider,
    consumers,
  };
}

/* ─── Flow ─────────────────────────────────────────────────────────── */

/**
 * Return a flow definition with its participating components resolved.
 */
export function catalogFlow(index: CatalogIndex, flowId: string): FlowResult | null {
  const flow = index.flows.find((f) => f.id === flowId);
  if (!flow) return null;

  const components: ComponentSummary[] = [];
  for (const participantId of flow.participants) {
    const comp = index.components.find((c) => c.id === participantId);
    if (comp) components.push(comp);
  }

  return { flow, components };
}

/* ─── Closure ──────────────────────────────────────────────────────── */

/**
 * Compute the transitive closure of dependencies for a set of root component ids.
 *
 * - Traverses "down" edges (what roots depend on).
 * - If includeConsumers is true, also traverses "up" edges (what depends on roots).
 * - Deduplicates: roots appear first (primary), transitive deps after.
 * - Capped at --max total components (default: no cap).
 */
export function catalogClosure(
  index: CatalogIndex,
  ids: string[],
  options: ClosureOptions = {},
): ClosureResult | null {
  const { includeConsumers = false, max } = options;

  // Validate all root ids exist
  const roots: ComponentSummary[] = [];
  for (const id of ids) {
    const comp = index.components.find((c) => c.id === id);
    if (!comp) return null; // invalid root
    roots.push(comp);
  }

  const graph = buildGraph(index);
  const visited = new Set<string>(ids);
  const transitive: ComponentSummary[] = [];

  // BFS from all roots
  let frontier = [...ids];
  const direction: DepsDirection = includeConsumers ? "both" : "down";

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];

    for (const nodeId of frontier) {
      const neighbors = getNeighbors(graph, nodeId, direction);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          nextFrontier.push(neighborId);
          const comp = index.components.find((c) => c.id === neighborId);
          if (comp) transitive.push(comp);
        }
      }
    }

    frontier = nextFrontier;
  }

  // Combine: roots first (primary), then transitive
  let allComponents = [...roots, ...transitive];
  let capped = false;

  if (max !== undefined && allComponents.length > max) {
    allComponents = allComponents.slice(0, max);
    capped = true;
  }

  return {
    roots: ids,
    components: allComponents,
    deduplicated: capped ? roots.length + transitive.length - allComponents.length : 0,
    capped,
  };
}
