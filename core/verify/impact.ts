/**
 * Impact analysis: lists consumers affected by a contract change.
 *
 * Reads the inverted consumer index from the catalog and returns each
 * consumer's criticality. Optionally emits per-consumer derived tasks
 * via the tracker provider (RF-54).
 *
 * Spec: §6.6, RF-51, RF-54.
 */

import type { CatalogIndex } from "../catalog/index-model.js";
import type { TrackerProvider } from "../providers/tracker.js";
import { resolveTrackerProvider } from "../providers/tracker.js";
import type { ImpactResult, ImpactConsumer, ImpactTaskResult, ImpactOptions } from "./types.js";

/**
 * Run impact analysis for a given contract id against the catalog index.
 *
 * @param index - The catalog index (contains contracts map and components).
 * @param options - Impact analysis options.
 * @param trackerProvider - Optional tracker provider override (defaults to resolveTrackerProvider).
 * @returns ImpactResult or null if the contract is not found.
 */
export async function runImpact(
  index: CatalogIndex,
  options: ImpactOptions,
  trackerProvider?: TrackerProvider,
): Promise<ImpactResult | null> {
  const { contractId, emitTasks = false } = options;
  const provider = trackerProvider ?? resolveTrackerProvider();

  // Look up the contract in the inverted consumer index
  const contractEntry = index.contracts[contractId];
  if (!contractEntry) {
    return null;
  }

  // Resolve each consumer to its full component for criticality
  const consumers: ImpactConsumer[] = [];
  for (const consumerId of contractEntry.consumers) {
    const component = index.components.find((c) => c.id === consumerId);
    if (!component) continue;

    // Find the specific consumption entry to get per-relationship criticality
    const consumeEntry = component.consumes.find((c) => c.contract === contractId);
    const criticality = consumeEntry?.criticality ?? component.criticality;

    consumers.push({
      id: component.id,
      name: component.name,
      repo: component.repo,
      criticality,
    });
  }

  // Emit tasks if requested
  const taskResults: ImpactTaskResult[] = [];
  let tasksEmitted = false;

  if (emitTasks) {
    if (!provider.isAvailable()) {
      // Graceful degradation: report that provider is unavailable
      for (const consumer of consumers) {
        taskResults.push({
          consumerId: consumer.id,
          success: false,
          error:
            "No tracker provider configured. Install a platform provider to enable --emit-tasks.",
        });
      }
    } else {
      tasksEmitted = true;
      for (const consumer of consumers) {
        const result = await provider.emitTask({
          repo: consumer.repo,
          title: `[Impact] Contract "${contractId}" changed — review consumer "${consumer.id}"`,
          body: [
            `Contract \`${contractId}\` (provided by \`${contractEntry.provider}\`) has changed.`,
            ``,
            `Consumer \`${consumer.id}\` (criticality: ${consumer.criticality}) may be affected.`,
            `Please review and update your integration accordingly.`,
          ].join("\n"),
          labels: ["contract-impact", `criticality:${consumer.criticality}`],
          metadata: {
            contractId,
            consumerId: consumer.id,
            criticality: consumer.criticality,
          },
        });
        taskResults.push({
          consumerId: consumer.id,
          success: result.success,
          taskUrl: result.taskUrl,
          error: result.error,
        });
      }
    }
  }

  return {
    contractId,
    provider: contractEntry.provider,
    consumers,
    tasksEmitted,
    taskResults,
  };
}
