/**
 * Core library barrel export.
 * All core modules are re-exported from here.
 */
export { ExitCode } from "./exit-codes.js";
export type { ExitCodeValue } from "./exit-codes.js";
export { reconcile } from "./reconcile.js";
export type { ReconcileAction } from "./reconcile.js";

// Module stubs — will be populated as features are implemented
export * as catalog from "./catalog/index.js";
export * as distribution from "./distribution/index.js";
export * as extract from "./extract/index.js";
export * as context from "./context/index.js";
export * as scope from "./scope/index.js";
export * as providers from "./providers/index.js";
export * as verify from "./verify/index.js";
