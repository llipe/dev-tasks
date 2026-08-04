/**
 * Layer 06: Boundary contracts.
 * Truncable. Renders boundary contracts with visible confidence badge.
 *
 * Spec: §6.3 layer ordering.
 */

import type { ScopeInput, MetaRepoContent } from "../assemble.js";

/** Confidence badge rendering */
function confidenceBadge(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case "high":
      return "[HIGH]";
    case "medium":
      return "[MEDIUM]";
    case "low":
      return "[LOW]";
    default:
      return "[UNKNOWN]";
  }
}

/**
 * Render the boundary contracts layer.
 * Includes contracts crossed by the scope with visible confidence.
 */
export function renderContractsLayer(scope: ScopeInput, metaRepo: MetaRepoContent): string {
  const lines: string[] = [];
  lines.push("# Boundary Contracts");
  lines.push("");

  const { index } = metaRepo;

  // Collect all contracts from primary components that are in contracts_crossed
  const relevantContracts = new Set(scope.contracts_crossed);

  // Also include contracts provided/consumed by primary components
  for (const id of scope.primary) {
    const comp = index.components.find((c) => c.id === id);
    if (comp) {
      for (const p of comp.provides) {
        relevantContracts.add(p.id);
      }
      for (const c of comp.consumes) {
        relevantContracts.add(c.contract);
      }
    }
  }

  if (relevantContracts.size === 0) {
    lines.push("_No boundary contracts in scope._");
    lines.push("");
    return lines.join("\n");
  }

  // Render each contract with confidence badge
  const sortedContracts = [...relevantContracts].sort();
  for (const contractId of sortedContracts) {
    const entry = index.contracts[contractId];
    if (!entry) {
      lines.push(`## ${contractId}`);
      lines.push("");
      lines.push("_Contract not found in catalog._");
      lines.push("");
      continue;
    }

    // Find confidence from the provider component's provides list
    const providerComp = index.components.find((c) => c.id === entry.provider);
    const provideEntry = providerComp?.provides.find((p) => p.id === contractId);
    const confidence = provideEntry?.confidence ?? "unknown";

    lines.push(`## ${contractId} ${confidenceBadge(confidence)}`);
    lines.push("");
    lines.push(`- **Kind:** ${entry.kind}`);
    lines.push(`- **Provider:** ${entry.provider}`);
    lines.push(`- **Consumers:** ${entry.consumers.join(", ") || "none"}`);
    lines.push("");

    // Include contract content if available from component docs
    const content = metaRepo.componentContent.get(entry.provider);
    if (content) {
      const contractFile = content.contracts.find((cf) => cf.id === contractId);
      if (contractFile) {
        lines.push(`### Contract Detail ${confidenceBadge(contractFile.confidence)}`);
        lines.push("");
        lines.push(contractFile.content);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}
