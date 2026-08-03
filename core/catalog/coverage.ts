/**
 * Extraction quality aggregation for catalog queries.
 * Reports per-component and per-confidence-level coverage.
 *
 * Spec: RF-53; Issue #46 AC3.
 */

import type { CatalogIndex, ExtractionQualityCounts } from "./index-model.js";

/* ─── Types ────────────────────────────────────────────────────────── */

export interface ComponentCoverage {
  id: string;
  counts: ExtractionQualityCounts;
  unresolved: number;
  total: number;
  /** Percentage of fields that are high confidence */
  highRatio: number;
  /** Percentage of fields that are low confidence */
  lowRatio: number;
}

export interface CoverageReport {
  /** Aggregate totals across all components */
  total: ExtractionQualityCounts & { fields: number };
  /** Aggregate ratios */
  ratios: {
    high: number;
    medium: number;
    low: number;
  };
  /** Per-component breakdown */
  components: ComponentCoverage[];
}

/* ─── Public API ───────────────────────────────────────────────────── */

/**
 * Compute extraction quality coverage for the entire catalog or a single component.
 *
 * @param index - The catalog index
 * @param id - Optional component id to filter to a single component
 */
export function catalogCoverage(index: CatalogIndex, id?: string): CoverageReport | null {
  const { extraction_quality } = index;

  let components: ComponentCoverage[];

  if (id) {
    const entry = extraction_quality.per_component.find((c) => c.component_id === id);
    if (!entry) return null;

    const total = entry.counts.high + entry.counts.medium + entry.counts.low;
    components = [
      {
        id: entry.component_id,
        counts: entry.counts,
        unresolved: entry.unresolved,
        total,
        highRatio: total > 0 ? entry.counts.high / total : 0,
        lowRatio: total > 0 ? entry.counts.low / total : 0,
      },
    ];
  } else {
    components = extraction_quality.per_component.map((entry) => {
      const total = entry.counts.high + entry.counts.medium + entry.counts.low;
      return {
        id: entry.component_id,
        counts: entry.counts,
        unresolved: entry.unresolved,
        total,
        highRatio: total > 0 ? entry.counts.high / total : 0,
        lowRatio: total > 0 ? entry.counts.low / total : 0,
      };
    });
  }

  // Aggregate totals
  const totalCounts = id ? components[0].counts : extraction_quality.total;

  const totalFields = totalCounts.high + totalCounts.medium + totalCounts.low;

  return {
    total: {
      ...totalCounts,
      fields: totalFields,
    },
    ratios: {
      high: totalFields > 0 ? totalCounts.high / totalFields : 0,
      medium: totalFields > 0 ? totalCounts.medium / totalFields : 0,
      low: totalFields > 0 ? totalCounts.low / totalFields : 0,
    },
    components,
  };
}
