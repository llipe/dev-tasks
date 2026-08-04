/**
 * Layer 04: Primary component documentation.
 * Truncable. Full docs for each primary component in scope.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render a primary component layer (full documentation).
 *
 * @param componentId - The component id to render
 * @param scope - The current scope
 * @param metaRepo - Meta-repo content
 */
export function renderPrimaryLayer(
  componentId: string,
  _scope: ScopeInput,
  metaRepo: MetaRepoContent,
): string {
  const lines: string[] = [];
  const { index } = metaRepo;

  const comp = index.components.find((c) => c.id === componentId);
  lines.push(`# ${componentId}`);
  lines.push("");

  if (comp) {
    lines.push(`> ${comp.description}`);
    lines.push("");
    lines.push(`- **Domain:** ${comp.domain}`);
    lines.push(`- **Type:** ${comp.type}`);
    lines.push(`- **Owner:** ${comp.owner}`);
    lines.push(`- **Lifecycle:** ${comp.lifecycle}`);
    lines.push(`- **Criticality:** ${comp.criticality}`);
    lines.push(`- **Stack:** ${comp.stack.join(", ")}`);
    lines.push("");

    if (comp.provides.length > 0) {
      lines.push("## Provides");
      lines.push("");
      for (const p of comp.provides) {
        lines.push(`- **${p.id}** (${p.kind}) — confidence: ${p.confidence ?? "unknown"}`);
      }
      lines.push("");
    }

    if (comp.consumes.length > 0) {
      lines.push("## Consumes");
      lines.push("");
      for (const c of comp.consumes) {
        lines.push(`- **${c.contract}** — criticality: ${c.criticality ?? "default"}`);
      }
      lines.push("");
    }
  } else {
    lines.push("_Component not found in catalog index._");
    lines.push("");
  }

  // Include full docs if available
  const content = metaRepo.componentContent.get(componentId);
  if (content?.docs) {
    lines.push("## Documentation");
    lines.push("");
    lines.push(content.docs);
    lines.push("");
  }

  return lines.join("\n");
}
