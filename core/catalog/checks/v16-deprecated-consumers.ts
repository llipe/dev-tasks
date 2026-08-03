/**
 * V16: Deprecated lifecycle with active consumers.
 * Warning when a deprecated/decommissioned component still has active consumers.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V16";
const DESCRIPTION = "Deprecated/decommissioned components should not have active consumers";

export const checkV16: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  // Build a map: provides[].id → provider component
  const providerMap = new Map<string, string>();
  for (const component of index.components) {
    for (const p of component.provides) {
      providerMap.set(p.id, component.id);
    }
  }

  // Build lifecycle lookup
  const lifecycleMap = new Map<string, string>();
  for (const component of index.components) {
    lifecycleMap.set(component.id, component.lifecycle);
  }

  // Find consumers of deprecated/decommissioned components
  const deprecatedProviders = new Set(
    index.components
      .filter((c) => c.lifecycle === "deprecated" || c.lifecycle === "decommissioned")
      .flatMap((c) => c.provides.map((p) => p.id)),
  );

  for (const component of index.components) {
    for (const c of component.consumes) {
      if (deprecatedProviders.has(c.contract)) {
        const providerId = providerMap.get(c.contract);
        const providerLifecycle = providerId ? lifecycleMap.get(providerId) : "unknown";
        violations.push({
          entity: component.id,
          message: `"${component.id}" consumes "${c.contract}" from ${providerLifecycle} provider "${providerId}"`,
          context: {
            contract: c.contract,
            provider: providerId,
            providerLifecycle,
          },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "warning")
    : failCheck(CHECK_ID, DESCRIPTION, "warning", violations);
};
