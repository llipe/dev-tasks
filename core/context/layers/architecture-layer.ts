/**
 * Layer 03: Architecture document.
 * Truncable. Provides the full architecture document from the meta-repo.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render the architecture layer.
 * If architecture.md is not available, returns a minimal placeholder.
 */
export function renderArchitectureLayer(_scope: ScopeInput, metaRepo: MetaRepoContent): string {
  const lines: string[] = [];
  lines.push("# Architecture");
  lines.push("");

  if (!metaRepo.architectureMd) {
    lines.push("_No architecture document available._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(metaRepo.architectureMd);
  lines.push("");

  return lines.join("\n");
}
