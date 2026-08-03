/**
 * V08: provides[].kind is a valid enum value.
 * V09: provides[].source is a valid enum value.
 * V10: consumes[].criticality is a valid enum value.
 *
 * These are structural validation checks on contract fields beyond what
 * the schema enforces (for cases where manifests bypass schema validation).
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const VALID_KINDS = new Set(["openapi", "asyncapi", "grpc", "graphql", "undocumented"]);
const VALID_SOURCES = new Set(["introspected", "generated", "inferred", "manual", "partial"]);
const VALID_CRITICALITIES = new Set(["hard", "soft"]);

const V08_ID = "V08";
const V08_DESC = "provides[].kind is a valid enum value";

export const checkV08: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    for (const p of component.provides) {
      if (!VALID_KINDS.has(p.kind)) {
        violations.push({
          entity: component.id,
          message: `Invalid provides[].kind "${p.kind}" in "${component.id}" contract "${p.id}"`,
          context: { providesId: p.id, kind: p.kind },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(V08_ID, V08_DESC, "error")
    : failCheck(V08_ID, V08_DESC, "error", violations);
};

const V09_ID = "V09";
const V09_DESC = "provides[].source is a valid enum value";

export const checkV09: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    for (const p of component.provides) {
      if (!VALID_SOURCES.has(p.source)) {
        violations.push({
          entity: component.id,
          message: `Invalid provides[].source "${p.source}" in "${component.id}" contract "${p.id}"`,
          context: { providesId: p.id, source: p.source },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(V09_ID, V09_DESC, "error")
    : failCheck(V09_ID, V09_DESC, "error", violations);
};

const V10_ID = "V10";
const V10_DESC = "consumes[].criticality is a valid enum value";

export const checkV10: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    for (const c of component.consumes) {
      if (c.criticality && !VALID_CRITICALITIES.has(c.criticality)) {
        violations.push({
          entity: component.id,
          message: `Invalid consumes[].criticality "${c.criticality}" in "${component.id}" contract "${c.contract}"`,
          context: { contract: c.contract, criticality: c.criticality },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(V10_ID, V10_DESC, "error")
    : failCheck(V10_ID, V10_DESC, "error", violations);
};
