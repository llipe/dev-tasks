/**
 * Layer 02: Conventions delta.
 * Non-truncable. Provides conventions relevant to the scoped components.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render the conventions delta layer.
 * If conventions.md is not available, returns a minimal placeholder.
 */
export function renderConventionsDeltaLayer(scope: ScopeInput, metaRepo: MetaRepoContent): string {
  const lines: string[] = [];
  lines.push("# Conventions");
  lines.push("");

  if (!metaRepo.conventionsMd) {
    lines.push("_No conventions document available._");
    lines.push("");
    return lines.join("\n");
  }

  // Include the full conventions content relevant to the scope's domains
  const { index } = metaRepo;
  const scopedDomains = new Set<string>();
  for (const id of [...scope.primary, ...scope.secondary]) {
    const comp = index.components.find((c) => c.id === id);
    if (comp) {
      scopedDomains.add(comp.domain);
    }
  }

  if (scopedDomains.size > 0) {
    lines.push(`**Relevant domains:** ${[...scopedDomains].sort().join(", ")}`);
    lines.push("");
  }

  lines.push(metaRepo.conventionsMd);
  lines.push("");

  return lines.join("\n");
}
