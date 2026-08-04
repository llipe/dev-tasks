/**
 * Layer 01: Flow definition.
 * Non-truncable (if a flow is in scope).
 *
 * Renders the flow definition with its participating components.
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/**
 * Render the flow layer.
 * If no flow is in scope, returns a minimal placeholder.
 */
export function renderFlowLayer(scope: ScopeInput, metaRepo: MetaRepoContent): string {
  const lines: string[] = [];
  lines.push("# Flow");
  lines.push("");

  if (!scope.flow) {
    lines.push("_No flow in scope._");
    lines.push("");
    return lines.join("\n");
  }

  const { index } = metaRepo;
  const flowEntry = index.flows.find((f) => f.id === scope.flow);

  if (!flowEntry) {
    lines.push(`_Flow "${scope.flow}" not found in catalog index._`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`## ${flowEntry.name}`);
  lines.push("");
  if (flowEntry.description) {
    lines.push(flowEntry.description);
    lines.push("");
  }
  lines.push(`**Flow ID:** ${flowEntry.id}`);
  lines.push("");

  if (flowEntry.aliases && flowEntry.aliases.length > 0) {
    lines.push(`**Aliases:** ${flowEntry.aliases.join(", ")}`);
    lines.push("");
  }

  lines.push("### Participants");
  lines.push("");
  for (const participantId of flowEntry.participants) {
    const comp = index.components.find((c) => c.id === participantId);
    if (comp) {
      lines.push(`- **${comp.id}**: ${comp.description}`);
    } else {
      lines.push(`- **${participantId}**: _not found in index_`);
    }
  }
  lines.push("");

  // Include flow file content if available
  if (metaRepo.flowContent?.has(scope.flow)) {
    lines.push("### Flow Definition");
    lines.push("");
    lines.push(metaRepo.flowContent.get(scope.flow)!);
    lines.push("");
  }

  return lines.join("\n");
}
