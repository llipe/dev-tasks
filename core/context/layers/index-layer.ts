/**
 * Layer 00: Catalog index summary.
 * Non-truncable. Provides a high-level overview of the scoped components.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render the catalog index summary layer.
 * Lists all primary and secondary components with their key metadata.
 */
export function renderIndexLayer(scope: ScopeInput, metaRepo: MetaRepoContent): string {
  const lines: string[] = [];
  lines.push("# Catalog Index Summary");
  lines.push("");

  const { index } = metaRepo;

  // Primary components
  lines.push("## Primary Components");
  lines.push("");
  for (const id of scope.primary) {
    const comp = index.components.find((c) => c.id === id);
    if (comp) {
      lines.push(`### ${comp.id}`);
      lines.push("");
      lines.push(`- **Name:** ${comp.name}`);
      lines.push(`- **Description:** ${comp.description}`);
      lines.push(`- **Domain:** ${comp.domain}`);
      lines.push(`- **Type:** ${comp.type}`);
      lines.push(`- **Lifecycle:** ${comp.lifecycle}`);
      lines.push(`- **Criticality:** ${comp.criticality}`);
      if (comp.provides.length > 0) {
        lines.push(`- **Provides:** ${comp.provides.map((p) => p.id).join(", ")}`);
      }
      if (comp.consumes.length > 0) {
        lines.push(`- **Consumes:** ${comp.consumes.map((c) => c.contract).join(", ")}`);
      }
      lines.push("");
    } else {
      lines.push(`### ${id}`);
      lines.push("");
      lines.push("_Component not found in index._");
      lines.push("");
    }
  }

  // Secondary components (brief)
  if (scope.secondary.length > 0) {
    lines.push("## Secondary Components");
    lines.push("");
    for (const id of scope.secondary) {
      const comp = index.components.find((c) => c.id === id);
      if (comp) {
        lines.push(`- **${comp.id}**: ${comp.description} (${comp.domain})`);
      } else {
        lines.push(`- **${id}**: _not found in index_`);
      }
    }
    lines.push("");
  }

  // Contracts crossed
  if (scope.contracts_crossed.length > 0) {
    lines.push("## Contracts Crossed");
    lines.push("");
    for (const contractId of scope.contracts_crossed) {
      const entry = index.contracts[contractId];
      if (entry) {
        lines.push(
          `- **${contractId}** (${entry.kind}) — provider: ${entry.provider}, consumers: ${entry.consumers.join(", ")}`,
        );
      } else {
        lines.push(`- **${contractId}** — _not found in contracts map_`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
