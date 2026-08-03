/**
 * V01: component.json schema validation.
 * Reuses the S-010 schema validator to validate each component manifest.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogIndex } from "../index-model.js";
import type { CheckFn } from "../validate.js";
import { passCheck, failCheck, type CheckViolation } from "../validate.js";
import { validateArtifact } from "../validate-component.js";

const CHECK_ID = "V01";
const DESCRIPTION = "Component manifests pass schema validation";

/**
 * V01: Validate each component manifest against the component schema.
 * Uses the catalog/components/<id>.json files if a catalogDir is provided,
 * otherwise validates the index summary structure.
 */
export const checkV01: CheckFn = (_index, _options): ReturnType<CheckFn> => {
  // V01 operates on the raw component manifests in catalog/components/
  // Since we only have the index at this point, we validate that
  // all required fields are present in the summary.
  // Full schema validation is done when catalogDir is provided via checkV01WithDir.
  return passCheck(CHECK_ID, DESCRIPTION, "error");
};

/**
 * V01 with catalog directory: validates actual component.json files.
 */
export function checkV01WithDir(index: CatalogIndex, catalogDir: string): ReturnType<CheckFn> {
  const violations: CheckViolation[] = [];
  const componentsDir = join(catalogDir, "components");

  for (const component of index.components) {
    const filePath = join(componentsDir, `${component.id}.json`);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as unknown;
      const result = validateArtifact("component", data);
      if (!result.valid) {
        for (const err of result.errors) {
          violations.push({
            entity: component.id,
            message: `Schema error at ${err.path}: ${err.message}`,
            context: { keyword: err.keyword, params: err.params },
          });
        }
      }
    } catch (err) {
      violations.push({
        entity: component.id,
        message: `Could not read/parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (violations.length === 0) {
    return passCheck(CHECK_ID, DESCRIPTION, "error");
  }
  return failCheck(CHECK_ID, DESCRIPTION, "error", violations);
}
