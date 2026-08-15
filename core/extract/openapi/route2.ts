/**
 * OpenAPI Route 2: Boot + Introspect route discovery.
 *
 * Boots the application in a child process and walks the Express router stack
 * to discover all registered routes — including dynamically-registered routes
 * that AST analysis (route3) cannot resolve.
 *
 * Strategy: spawn a child process that imports the app module, locates the
 * Express app export, walks `app._router.stack`, and prints discovered routes
 * as JSON to stdout. The parent process handles timeouts and failures gracefully.
 *
 * Failure taxonomy:
 * - entry-not-found: no resolvable entry point in package.json or common paths
 * - import-failed: module import threw an error
 * - no-app-export: module loaded but no Express app found in exports
 * - timeout: boot exceeded the configured timeout
 * - parse-error: child process output was not valid JSON
 *
 * All failures return null (rung unavailable), never crash dt.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { OpenApiExtractionResult } from "./types.js";

/**
 * Configuration for route2 extraction.
 */
export interface Route2Options {
  /** Override entry point path (relative to fixtureDir or absolute) */
  entry?: string;
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Route2 extraction configuration (legacy interface kept for compatibility).
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
 * Route2 extractor interface (legacy — kept for compatibility).
 */
export interface Route2Extractor {
  extract(config: Route2Config): Promise<OpenApiExtractionResult>;
  canBoot(config: Route2Config): Promise<boolean>;
}

interface IntrospectEndpoint {
  method: string;
  path: string;
}

interface IntrospectResult {
  endpoints: IntrospectEndpoint[];
  framework: string;
}

const DEFAULT_TIMEOUT = 10_000;

/**
 * Common entry point candidates, checked in order.
 */
const ENTRY_CANDIDATES = [
  "src/app.ts",
  "src/index.ts",
  "src/server.ts",
  "app.ts",
  "index.ts",
  "server.ts",
  "src/app.js",
  "src/index.js",
  "app.js",
  "index.js",
];

/**
 * Resolve the application entry point from a project directory.
 * Checks package.json `main` first, then common candidates.
 */
function resolveEntryPoint(rootDir: string, entryOverride?: string): string | null {
  if (entryOverride) {
    const resolved = resolve(rootDir, entryOverride);
    return existsSync(resolved) ? resolved : null;
  }

  // Check package.json main field
  const pkgPath = join(rootDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
      if (typeof pkg.main === "string") {
        const mainPath = resolve(rootDir, pkg.main);
        if (existsSync(mainPath)) return mainPath;
      }
    } catch {
      // Invalid package.json, continue to candidates
    }
  }

  // Check common candidates
  for (const candidate of ENTRY_CANDIDATES) {
    const candidatePath = resolve(rootDir, candidate);
    if (existsSync(candidatePath)) return candidatePath;
  }

  return null;
}

/**
 * Extract OpenAPI endpoints by booting an Express app and introspecting its router.
 *
 * Returns null if:
 * - No entry point found
 * - Boot fails (import error, no app export, timeout)
 * - Output is unparseable
 *
 * Never throws — failures are "rung unavailable".
 */
export async function extractRoute2Express(
  rootDir: string,
  options: Route2Options = {},
): Promise<OpenApiExtractionResult | null> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const entryPoint = resolveEntryPoint(rootDir, options.entry);

  if (!entryPoint) {
    return null;
  }

  // Path to the introspection script
  const thisFile = fileURLToPath(import.meta.url);
  const introspectScript = join(dirname(thisFile), "route2-introspect.ts");

  // Find tsx binary for running TypeScript
  const tsxBin = resolve(rootDir, "node_modules/.bin/tsx");
  const globalTsx = "tsx";

  // Determine which tsx to use
  const runner = existsSync(tsxBin) ? tsxBin : globalTsx;

  try {
    const result = await new Promise<{ stdout: string; stderr: string }>(
      (resolvePromise, reject) => {
        const child = execFile(
          runner,
          [introspectScript, entryPoint],
          {
            cwd: rootDir,
            timeout,
            env: {
              ...process.env,
              NODE_ENV: "test",
              // Prevent the app from actually listening
              PORT: "0",
              // Allow resolving deps from the nearest node_modules.
              // In production, the target project has its own node_modules.
              // We look upward from rootDir to find the nearest one (supports
              // both monorepos and test fixtures under a parent project).
              NODE_PATH: findNodeModulesPath(rootDir),
            },
            maxBuffer: 10 * 1024 * 1024, // 10MB
          },
          (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              resolvePromise({ stdout, stderr });
            }
          },
        );

        // Safety: kill on timeout (execFile already handles this, but double-safe)
        child.on("error", reject);
      },
    );

    // Parse the output
    let parsed: IntrospectResult;
    try {
      parsed = JSON.parse(result.stdout) as IntrospectResult;
    } catch {
      return null; // parse-error
    }

    if (!parsed.endpoints || !Array.isArray(parsed.endpoints)) {
      return null;
    }

    // Convert to OpenApiExtractionResult
    const endpoints = parsed.endpoints
      .filter((e) => e.method && e.path)
      .map((e) => ({
        method: e.method.toLowerCase(),
        path: e.path,
        parameters: extractPathParams(e.path),
        responses: [
          {
            statusCode: "200",
            contentType: "application/json",
            schema: null,
            description: "Response",
          },
        ],
        typed: false,
        confidence: "high" as const,
      }));

    return {
      openapi: "3.1.0",
      info: { title: "API", version: "1.0.0" },
      endpoints,
      unresolved: [],
      source: "observed" as const,
      confidence: "high",
      strategy: "route2" as const,
    };
  } catch {
    // Any error (timeout, exit code, etc.) = rung unavailable
    return null;
  }
}

/**
 * Find the nearest node_modules directory by traversing up from a starting path.
 * Returns a NODE_PATH-compatible string with paths separated by `:`.
 */
function findNodeModulesPath(startDir: string): string {
  const paths: string[] = [];
  let current = startDir;
  const root = resolve("/");

  while (current !== root) {
    const nmPath = join(current, "node_modules");
    if (existsSync(nmPath)) {
      paths.push(nmPath);
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Include existing NODE_PATH if set
  if (process.env.NODE_PATH) {
    paths.push(process.env.NODE_PATH);
  }

  return paths.join(":");
}

/**
 * Extract path parameters from a route pattern.
 */
function extractPathParams(
  path: string,
): Array<{ name: string; in: "path"; required: boolean; type: string }> {
  const params: Array<{ name: string; in: "path"; required: boolean; type: string }> = [];
  const matches = path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of matches) {
    params.push({ name: match[1], in: "path", required: true, type: "string" });
  }
  return params;
}

/**
 * Legacy placeholder — kept for backward compatibility with existing imports.
 * @deprecated Use extractRoute2Express instead.
 */
export function extractRoute2(_config: Route2Config): Promise<OpenApiExtractionResult> {
  return Promise.reject(
    new Error("Legacy extractRoute2 is deprecated. Use extractRoute2Express() instead."),
  );
}
