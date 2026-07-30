/**
 * Extraction report generation.
 * Produces extraction_report.json alongside component.yaml.
 *
 * Reports: strategies used, coverage (endpoints/topics/tables resolved vs unresolved),
 * confidence counts, unresolved[] with location + reason, requires_human[].
 */

import type { Confidence } from "./component.js";

/**
 * Strategy info for the report.
 */
export interface StrategyEntry {
  stage: string;
  strategy: string;
  source: string;
  confidence: Confidence;
}

/**
 * Coverage metrics for the report.
 */
export interface CoverageMetrics {
  endpoints: { resolved: number; unresolved: number; total: number };
  topics: { resolved: number; unresolved: number; total: number };
  tables: { resolved: number; unresolved: number; total: number };
}

/**
 * Unresolved item in the report.
 */
export interface UnresolvedItem {
  stage: string;
  type: string;
  location: string;
  reason: string;
}

/**
 * Entry requiring human input.
 */
export interface RequiresHumanItem {
  field: string;
  reason: string;
  category: "non-derivable" | "unconfirmed-inference" | "missing-capability";
}

/**
 * Confidence distribution.
 */
export interface ConfidenceCounts {
  high: number;
  medium: number;
  low: number;
}

/**
 * The full extraction report.
 */
export interface ExtractionReport {
  generated_at: string;
  strategies: StrategyEntry[];
  coverage: CoverageMetrics;
  confidence_counts: ConfidenceCounts;
  unresolved: UnresolvedItem[];
  requires_human: RequiresHumanItem[];
}

/**
 * Inputs for building the extraction report.
 */
export interface ReportInputs {
  strategies: StrategyEntry[];
  endpointsResolved: number;
  endpointsUnresolved: number;
  topicsResolved: number;
  topicsUnresolved: number;
  tablesResolved: number;
  tablesUnresolved: number;
  unresolved: UnresolvedItem[];
  requiresHuman: RequiresHumanItem[];
  confidenceEntries: Confidence[];
}

/**
 * Build an extraction report from inputs.
 */
export function buildExtractionReport(inputs: ReportInputs): ExtractionReport {
  const confidenceCounts: ConfidenceCounts = { high: 0, medium: 0, low: 0 };

  for (const c of inputs.confidenceEntries) {
    confidenceCounts[c]++;
  }

  return {
    generated_at: new Date().toISOString(),
    strategies: inputs.strategies,
    coverage: {
      endpoints: {
        resolved: inputs.endpointsResolved,
        unresolved: inputs.endpointsUnresolved,
        total: inputs.endpointsResolved + inputs.endpointsUnresolved,
      },
      topics: {
        resolved: inputs.topicsResolved,
        unresolved: inputs.topicsUnresolved,
        total: inputs.topicsResolved + inputs.topicsUnresolved,
      },
      tables: {
        resolved: inputs.tablesResolved,
        unresolved: inputs.tablesUnresolved,
        total: inputs.tablesResolved + inputs.tablesUnresolved,
      },
    },
    confidence_counts: confidenceCounts,
    unresolved: inputs.unresolved,
    requires_human: inputs.requiresHuman,
  };
}

/**
 * Serialize the report to JSON string.
 */
export function serializeReport(report: ExtractionReport): string {
  return JSON.stringify(report, null, 2);
}
