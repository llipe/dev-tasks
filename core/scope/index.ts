/**
 * Scope module — LLM-assisted scoping with schema validation and repair retry.
 */
export { runScoping, EXIT_INVALID_SCOPE } from "./scoping.js";
export type { ScopingOptions, ScopingResult, ScopingSuccess, ScopingFailure } from "./scoping.js";
export { buildScopingInput, serializeScopingInput, SCOPING_SYSTEM_PROMPT } from "./prompt.js";
export { validateScopeSchema, validateScopeIds, parseLlmResponse } from "./validate.js";
export type { ValidationResult, IdValidationResult } from "./validate.js";
export { buildCalibrationRecord, writeCalibrationRecord, hashTaskText } from "./calibration.js";
export type {
  ScopeOutput,
  ScopingInput,
  ScopingCandidate,
  ScopingFlow,
  ScopingDomain,
  CalibrationRecord,
  LlmScopeProvider,
} from "./types.js";
