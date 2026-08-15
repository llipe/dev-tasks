/**
 * Extraction report generation.
 * Produces extraction_report.json alongside component.json.
 *
 * Reports: strategies used, coverage (endpoints/topics/tables resolved vs unresolved),
 * confidence counts, unresolved[] with location + reason, requires_human[],
 * rung provenance per strategy, and handoff section for agent consumption.
 */

import type { Confidence } from "./component.js";
import type { RungKind } from "./ladder.js";

/**
 * Strategy info for the report.
 */
export interface StrategyEntry {
  stage: string;
  strategy: string;
  source: string;
  confidence: Confidence;
  /** Rung that produced this result (additive — omitted for legacy extractors) */
  rung?: RungKind;
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
  /** Agent handoff section — lists judgment fields and unresolved items for agent consumption */
  handoff?: HandoffSection;
}

/**
 * Handoff section for agent consumption.
 * Lists (a) judgment fields left empty by deterministic extraction, and
 * (b) unresolved items that need human/agent resolution.
 */
export interface HandoffSection {
  /** Judgment fields that dt cannot produce (descriptions, summaries, etc.) */
  empty_judgment_fields: HandoffField[];
  /** Unresolved items from extraction that need resolution */
  unresolved_items: UnresolvedItem[];
}

/**
 * A single judgment field that needs agent/human filling.
 */
export interface HandoffField {
  /** JSON pointer to the empty field in component.json */
  pointer: string;
  /** What kind of content is expected */
  expected: string;
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
  /** Optional handoff section for agent consumption */
  handoff?: HandoffSection;
}

/**
 * Build an extraction report from inputs.
 */
export function buildExtractionReport(inputs: ReportInputs): ExtractionReport {
  const confidenceCounts: ConfidenceCounts = { high: 0, medium: 0, low: 0 };

  for (const c of inputs.confidenceEntries) {
    confidenceCounts[c]++;
  }

  const report: ExtractionReport = {
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

  if (inputs.handoff) {
    report.handoff = inputs.handoff;
  }

  return report;
}

/**
 * Serialize the report to JSON string.
 */
export function serializeReport(report: ExtractionReport): string {
  return JSON.stringify(report, null, 2);
}
