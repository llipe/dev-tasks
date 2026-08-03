/**
 * V11: Non-empty manual fields — fields with source: manual must not be empty strings.
 * Checks the catalog/components/ manifests for provenance fields marked as manual.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogIndex } from "../index-model.js";
import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V11";
const DESCRIPTION = "Fields with source: manual must not be empty";

/**
 * V11 at index level: cannot fully validate without manifest files.
 * Returns pass — full check requires catalogDir.
 */
export const checkV11: CheckFn = () => {
  return passCheck(CHECK_ID, DESCRIPTION, "error");
};

/**
 * V11 with catalog directory: validate that manual-sourced fields are not empty.
 */
export function checkV11WithDir(index: CatalogIndex, catalogDir: string): ReturnType<CheckFn> {
  const violations: CheckViolation[] = [];
  const componentsDir = join(catalogDir, "components");

  for (const component of index.components) {
    try {
      const filePath = join(componentsDir, `${component.id}.json`);
      const raw = readFileSync(filePath, "utf-8");
      const manifest = JSON.parse(raw) as Record<string, unknown> & {
        _provenance?: {
          fields?: Record<string, { source?: string; confidence?: string }>;
        };
      };

      const fields = manifest._provenance?.fields;
      if (!fields) continue;

      for (const [fieldName, meta] of Object.entries(fields)) {
        if (meta.source === "manual") {
          const value = manifest[fieldName];
          if (value === "" || value === null || value === undefined) {
            violations.push({
              entity: component.id,
              message: `Manual field "${fieldName}" is empty in "${component.id}"`,
              context: { field: fieldName },
            });
          }
          // Also check arrays that are empty
          if (Array.isArray(value) && value.length === 0) {
            violations.push({
              entity: component.id,
              message: `Manual field "${fieldName}" is an empty array in "${component.id}"`,
              context: { field: fieldName },
            });
          }
        }
      }
    } catch {
      // File not readable — V01 will catch this
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "error")
    : failCheck(CHECK_ID, DESCRIPTION, "error", violations);
}
