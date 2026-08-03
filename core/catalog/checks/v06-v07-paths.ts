/**
 * V06: docs.root path reference is valid (non-empty when declared).
 * V07: paths.source entries are valid references (non-empty array with non-empty strings).
 *
 * These checks validate structural correctness of path references in the manifest.
 * Actual filesystem existence is not verified (that's a CI-time concern).
 */

import type { CatalogIndex } from "../index-model.js";
import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const V06_ID = "V06";
const V06_DESC = "docs references are valid (non-empty strings)";

const V07_ID = "V07";
const V07_DESC = "paths.source entries are valid (non-empty array)";

/**
 * V06: Validate docs references. In the index summary we don't have full docs,
 * but we validate that the component manifest docs fields are structurally sound
 * when a catalogDir is available. At index level, we check component summaries
 * have required fields.
 */
export const checkV06: CheckFn = (_index) => {
  // At index level, docs fields are not surfaced in ComponentSummary.
  // V06 passes at index level — full check requires catalogDir.
  return passCheck(V06_ID, V06_DESC, "error");
};

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * V06 with catalog directory: validate docs references in actual manifests.
 */
export function checkV06WithDir(index: CatalogIndex, catalogDir: string): ReturnType<CheckFn> {
  const violations: CheckViolation[] = [];
  const componentsDir = join(catalogDir, "components");

  for (const component of index.components) {
    try {
      const filePath = join(componentsDir, `${component.id}.json`);
      const raw = readFileSync(filePath, "utf-8");
      const manifest = JSON.parse(raw) as {
        docs?: { architecture?: string; schema?: string };
      };
      if (manifest.docs) {
        if (manifest.docs.architecture !== undefined && manifest.docs.architecture.trim() === "") {
          violations.push({
            entity: component.id,
            message: `docs.architecture is empty in "${component.id}"`,
          });
        }
        if (manifest.docs.schema !== undefined && manifest.docs.schema.trim() === "") {
          violations.push({
            entity: component.id,
            message: `docs.schema is empty in "${component.id}"`,
          });
        }
      }
    } catch {
      // File not readable — V01 will catch this
    }
  }

  return violations.length === 0
    ? passCheck(V06_ID, V06_DESC, "error")
    : failCheck(V06_ID, V06_DESC, "error", violations);
}

/**
 * V07: paths.source entries are valid (non-empty array with non-empty strings).
 */
export const checkV07: CheckFn = (_index) => {
  // At index level, paths are not surfaced in ComponentSummary.
  return passCheck(V07_ID, V07_DESC, "error");
};

/**
 * V07 with catalog directory: validate paths.source in actual manifests.
 */
export function checkV07WithDir(index: CatalogIndex, catalogDir: string): ReturnType<CheckFn> {
  const violations: CheckViolation[] = [];
  const componentsDir = join(catalogDir, "components");

  for (const component of index.components) {
    try {
      const filePath = join(componentsDir, `${component.id}.json`);
      const raw = readFileSync(filePath, "utf-8");
      const manifest = JSON.parse(raw) as {
        paths?: { source?: string[] };
      };
      if (manifest.paths) {
        if (
          !manifest.paths.source ||
          !Array.isArray(manifest.paths.source) ||
          manifest.paths.source.length === 0
        ) {
          violations.push({
            entity: component.id,
            message: `paths.source is empty or missing in "${component.id}"`,
          });
        } else {
          for (const s of manifest.paths.source) {
            if (typeof s !== "string" || s.trim() === "") {
              violations.push({
                entity: component.id,
                message: `paths.source contains empty entry in "${component.id}"`,
              });
            }
          }
        }
      }
    } catch {
      // File not readable — V01 will catch this
    }
  }

  return violations.length === 0
    ? passCheck(V07_ID, V07_DESC, "error")
    : failCheck(V07_ID, V07_DESC, "error", violations);
}
