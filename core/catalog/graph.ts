/**
 * Graph utilities for catalog validation and querying.
 * Builds a directed graph from the catalog index where nodes are components
 * and edges represent consumes→provides relationships.
 *
 * Provides cycle detection using Tarjan's algorithm.
 */

import type { CatalogIndex, ComponentSummary } from "./index-model.js";

/* ─── Graph Types ──────────────────────────────────────────────────── */

export interface GraphNode {
  id: string;
  domain: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  contract: string;
}

export interface CatalogGraph {
  nodes: Map<string, GraphNode>;
  /** Adjacency list: component id → outgoing edges (components it depends on) */
  edges: Map<string, GraphEdge[]>;
  /** Reverse adjacency: component id → incoming edges (components that depend on it) */
  reverseEdges: Map<string, GraphEdge[]>;
}

export interface Cycle {
  /** Component ids forming the cycle */
  members: string[];
}

/* ─── Graph Construction ───────────────────────────────────────────── */

/**
 * Build a directed graph from the catalog index.
 * Edges go from consumer → provider (following the dependency direction).
 */
export function buildGraph(index: CatalogIndex): CatalogGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();
  const reverseEdges = new Map<string, GraphEdge[]>();

  // Build the provides lookup: contract id → provider component id
  const providesLookup = new Map<string, string>();
  for (const component of index.components) {
    nodes.set(component.id, { id: component.id, domain: component.domain });
    edges.set(component.id, []);
    reverseEdges.set(component.id, []);

    for (const p of component.provides) {
      providesLookup.set(p.id, component.id);
    }
  }

  // Build edges from consumes→provides
  for (const component of index.components) {
    for (const c of component.consumes) {
      const providerId = providesLookup.get(c.contract);
      if (providerId && providerId !== component.id) {
        const edge: GraphEdge = {
          from: component.id,
          to: providerId,
          contract: c.contract,
        };
        edges.get(component.id)!.push(edge);
        reverseEdges.get(providerId)!.push(edge);
      }
    }
  }

  return { nodes, edges, reverseEdges };
}

/* ─── Cycle Detection (Tarjan's Algorithm) ─────────────────────────── */

/**
 * Detect all strongly connected components (cycles) in the graph
 * using Tarjan's algorithm. Returns only SCCs with more than one member.
 */
export function detectCycles(graph: CatalogGraph): Cycle[] {
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: Cycle[] = [];
  let nextIndex = 0;

  function strongconnect(v: string): void {
    index.set(v, nextIndex);
    lowlink.set(v, nextIndex);
    nextIndex++;
    stack.push(v);
    onStack.add(v);

    const neighbors = graph.edges.get(v) ?? [];
    for (const edge of neighbors) {
      const w = edge.to;
      if (!index.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Only report SCCs with >1 member (actual cycles)
      if (scc.length > 1) {
        cycles.push({ members: scc.sort() });
      }
    }
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!index.has(nodeId)) {
      strongconnect(nodeId);
    }
  }

  return cycles;
}

/**
 * Check if a cycle is in the allowed list.
 * Allowed cycles are specified as arrays of component ids.
 * A cycle is allowed if its sorted members match any allowed entry.
 */
export function isCycleAllowed(cycle: Cycle, allowedCycles: string[][]): boolean {
  const sorted = [...cycle.members].sort();
  return allowedCycles.some((allowed) => {
    const sortedAllowed = [...allowed].sort();
    if (sortedAllowed.length !== sorted.length) return false;
    return sortedAllowed.every((id, i) => id === sorted[i]);
  });
}

/**
 * Get all components in a specific domain.
 */
export function getComponentsByDomain(index: CatalogIndex, domain: string): ComponentSummary[] {
  return index.components.filter((c) => c.domain === domain);
}
