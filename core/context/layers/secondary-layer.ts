/**
 * Layer 05: Secondary component summaries.
 * Truncable. Summary only for each secondary component (id, description, provides/consumes).
 * No full docs included — only a brief overview.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render a secondary component layer (summary only).
 * Includes: id, description, provides list, consumes list.
 * Does NOT include full documentation.
 *
 * @param componentId - The component id to render
 * @param scope - The current scope
 * @param metaRepo - Meta-repo content
 */
export function renderSecondaryLayer(
  componentId: string,
  _scope: ScopeInput,
  metaRepo: MetaRepoContent,
): string {
  const lines: string[] = [];
  const { index } = metaRepo;

  const comp = index.components.find((c) => c.id === componentId);
  lines.push(`# ${componentId} (secondary)`);
  lines.push("");

  if (comp) {
    lines.push(`> ${comp.description}`);
    lines.push("");
    lines.push(`- **Domain:** ${comp.domain}`);
    lines.push(`- **Type:** ${comp.type}`);
    lines.push("");

    if (comp.provides.length > 0) {
      lines.push("## Provides");
      lines.push("");
      for (const p of comp.provides) {
        lines.push(`- ${p.id} (${p.kind})`);
      }
      lines.push("");
    }

    if (comp.consumes.length > 0) {
      lines.push("## Consumes");
      lines.push("");
      for (const c of comp.consumes) {
        lines.push(`- ${c.contract}`);
      }
      lines.push("");
    }
  } else {
    lines.push("_Component not found in catalog index._");
    lines.push("");
  }

  return lines.join("\n");
}
