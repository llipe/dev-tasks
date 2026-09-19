/**
 * Core library barrel export.
 * All core modules are re-exported from here.
 */
export { ExitCode } from "./exit-codes.js";
export type { ExitCodeValue } from "./exit-codes.js";
export { reconcile } from "./reconcile.js";
export type { ReconcileAction } from "./reconcile.js";

export * as distribution from "./distribution/index.js";
