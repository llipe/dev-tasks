/**
 * Shared types for the scope module.
 */

/**
 * The raw scope output returned by the LLM scoping call.
 * Must conform to scope-output.schema.json.
 */
export interface ScopeOutput {
  schemaVersion: string;
  primary: string[];
  secondary: string[];
  contracts_crossed: string[];
  confidence: "high" | "medium" | "low";
  unresolved: string[];
  rationale: string;
  flow?: string;
}

/**
 * Input provided to the scoping LLM call.
 * Contains only: task, candidates, flows, domains (spec §7.1).
 */
export interface ScopingInput {
  task: string;
  candidates: ScopingCandidate[];
  flows: ScopingFlow[];
  domains: ScopingDomain[];
}

/**
 * A candidate component for the scoping call.
 * Derived from resolve results — not the full catalog.
 */
export interface ScopingCandidate {
  id: string;
  name: string;
  description: string;
  domain: string;
  provides: string[];
  consumes: string[];
}

/**
 * A flow entry for scoping context.
 */
export interface ScopingFlow {
  id: string;
  name: string;
  participants: string[];
}

/**
 * A domain entry for scoping context.
 */
export interface ScopingDomain {
  name: string;
  components: string[];
}

/**
 * Calibration record for a scoping session.
 */
export interface CalibrationRecord {
  timestamp: string;
  taskTextHash: string;
  primary: string[];
  secondary: string[];
  confidence: "high" | "medium" | "low";
  unresolved: string[];
}

/**
 * LLM provider interface for the scoping call.
 * Accepts the assembled input and returns raw JSON string from the LLM.
 */
export interface LlmScopeProvider {
  /**
   * Call the LLM with the assembled scoping prompt + input.
   * Returns the raw response string (expected to be JSON).
   */
  scopeCall(systemPrompt: string, userInput: string): Promise<string>;
}
