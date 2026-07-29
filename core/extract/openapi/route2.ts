/**
 * OpenAPI Route 2: Isolated framework boot (NOT IMPLEMENTED).
 *
 * This file defines the interface for a future Route 2 extractor that would:
 * 1. Boot the framework in an isolated environment
 * 2. Introspect the route table at runtime
 * 3. Extract full OpenAPI specs with runtime type information
 *
 * This is a capability hook only — implementation is deferred.
 */

import type { OpenApiExtractionResult } from "./types.js";

/**
 * Configuration for the route 2 framework boot extractor.
 */
export interface Route2Config {
  /** Path to the application entry point */
  entryPoint: string;
  /** Framework type to boot */
  framework: "express" | "fastify" | "nestjs" | "hono";
  /** Port to use for the isolated server (defaults to random available) */
  port?: number;
  /** Timeout in ms for boot + introspection (defaults to 10000) */
  timeout?: number;
  /** Environment variables to pass to the booted process */
  env?: Record<string, string>;
}

/**
 * Route 2 extractor interface.
 * A future implementation would:
 * 1. Spawn the app in a child process with instrumentation
 * 2. Wait for the server to be ready
 * 3. Query the framework's internal route table
 * 4. Shut down the process cleanly
 */
export interface Route2Extractor {
  /** Boot the framework and extract the route table */
  extract(config: Route2Config): Promise<OpenApiExtractionResult>;
  /** Check if the framework can be booted (deps installed, entry point valid) */
  canBoot(config: Route2Config): Promise<boolean>;
}

/**
 * Placeholder: Route 2 is not yet implemented.
 * Calling this will throw an error indicating the feature is pending.
 */
export function extractRoute2(_config: Route2Config): Promise<OpenApiExtractionResult> {
  return Promise.reject(
    new Error(
      "Route 2 (isolated framework boot) is not yet implemented. " +
        "Use --strategy 1 (on-disk spec) or --strategy 3 (AST analysis) instead.",
    ),
  );
}
