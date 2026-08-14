/**
 * Route 2 Introspection Script — runs as a child process.
 *
 * This script:
 * 1. Receives the app entry point path via argv[2]
 * 2. Imports the module
 * 3. Locates the Express app export (default, named `app`, or `createApp()` factory)
 * 4. Walks the router stack recursively to enumerate all routes
 * 5. Prints JSON to stdout
 *
 * Supports both Express 4 (app._router.stack) and Express 5 (app.router.stack).
 *
 * The parent process (`extractRoute2Express`) runs this via execa with a hard timeout.
 * Any failure (import error, no app found, etc.) results in a non-zero exit with
 * a JSON error payload on stderr.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface DiscoveredRoute {
  method: string;
  path: string;
}

interface IntrospectResult {
  endpoints: DiscoveredRoute[];
  framework: "express";
}

interface IntrospectError {
  error: string;
  code: string;
}

// Express 5 uses layer.match() to populate layer.path with the mount prefix

/**
 * Walk the Express router stack recursively to extract all registered routes.
 * Supports both Express 4 and Express 5 internal structures.
 */
function walkStack(
  stack: Array<Record<string, unknown>>,
  basePath: string,
): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];

  for (const layer of stack) {
    if (layer.route) {
      // This is a route layer (app.get, app.post, etc.)
      const route = layer.route as {
        path: string;
        methods: Record<string, boolean>;
      };
      const fullPath = composePath(basePath, route.path);
      for (const method of Object.keys(route.methods)) {
        if (route.methods[method]) {
          routes.push({ method, path: fullPath });
        }
      }
    } else if (layer.handle && (layer.handle as Record<string, unknown>).stack) {
      // This is a mounted sub-router
      const prefix = extractMountPrefix(layer);
      const nestedPath = composePath(basePath, prefix);
      const nestedStack = (layer.handle as { stack: Array<Record<string, unknown>> }).stack;
      routes.push(...walkStack(nestedStack, nestedPath));
    }
  }

  return routes;
}

/**
 * Extract the mount prefix from a router layer.
 * 
 * Express 4: uses layer.regexp or layer.path
 * Express 5: uses layer.match() — calling match populates layer.path
 */
function extractMountPrefix(layer: Record<string, unknown>): string {
  // Express 5: use Layer.match() if available
  if (typeof layer.match === "function") {
    // We need a test path that would match. Express 5 uses prefix matching for
    // use() middleware, so try common patterns until one matches.
    const testPaths = generateTestPaths();
    for (const testPath of testPaths) {
      const matched = (layer.match as (p: string) => boolean)(testPath);
      if (matched && typeof layer.path === "string") {
        return layer.path;
      }
    }
    // If layer.path was already set (catch-all "/")
    if (typeof layer.path === "string") {
      return layer.path === "/" ? "" : layer.path;
    }
    return "";
  }

  // Express 4: try layer.path first
  if (typeof layer.path === "string" && layer.path) {
    return layer.path;
  }

  // Express 4: parse from regexp
  const regexp = layer.regexp as RegExp | undefined;
  if (regexp) {
    const source = regexp.source;
    const match = source.match(/^\^((?:\\\/[^?(*]+)+)/);
    if (match) {
      return match[1].replace(/\\\//g, "/");
    }
  }

  return "";
}

/**
 * Generate test paths to probe Express 5 matchers.
 * Includes common API prefixes and exhaustive single/double-segment combos.
 */
function generateTestPaths(): string[] {
  const paths: string[] = ["/"];
  const segments = [
    "api", "v1", "v2", "v3", "admin", "auth", "public", "internal",
    "health", "metrics", "webhooks", "users", "static", "assets",
  ];
  
  // Single-segment paths
  for (const seg of segments) {
    paths.push(`/${seg}/test`);
  }
  
  // Double-segment paths (cover /api/v1, /api/v2, etc.)
  for (const s1 of segments) {
    for (const s2 of segments) {
      paths.push(`/${s1}/${s2}/test`);
    }
  }
  
  return paths;
}

/**
 * Compose two path segments, handling trailing/leading slashes.
 */
function composePath(base: string, segment: string): string {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedSegment = segment.startsWith("/") ? segment : segment ? `/${segment}` : "";
  const composed = normalizedBase + normalizedSegment;
  return composed || "/";
}

/**
 * Try to locate an Express app from a module's exports.
 * Checks: default export, named `app`, `createApp()` factory.
 */
function findExpressApp(moduleExports: Record<string, unknown>): Record<string, unknown> | null {
  // Check default export
  if (moduleExports.default && isExpressApp(moduleExports.default)) {
    return moduleExports.default as Record<string, unknown>;
  }

  // Check named `app` export
  if (moduleExports.app && isExpressApp(moduleExports.app)) {
    return moduleExports.app as Record<string, unknown>;
  }

  // Check `createApp` factory
  if (typeof moduleExports.createApp === "function") {
    try {
      const app = (moduleExports.createApp as () => unknown)();
      if (isExpressApp(app)) return app as Record<string, unknown>;
    } catch {
      // Factory failed, continue
    }
  }

  // Check any export that looks like an Express app
  for (const key of Object.keys(moduleExports)) {
    if (key === "default" || key === "app" || key === "createApp") continue;
    if (isExpressApp(moduleExports[key])) {
      return moduleExports[key] as Record<string, unknown>;
    }
  }

  return null;
}

/**
 * Check if a value looks like an Express app.
 * Express 4: app._router.stack
 * Express 5: app.router.stack
 */
function isExpressApp(value: unknown): boolean {
  if (!value || typeof value !== "function") return false;
  return getRouterStack(value as unknown as Record<string, unknown>) !== null;
}

/**
 * Get the router stack from an Express app (supports Express 4 and 5).
 */
function getRouterStack(app: Record<string, unknown>): Array<Record<string, unknown>> | null {
  // Express 5: app.router.stack
  const router5 = app.router as Record<string, unknown> | undefined;
  if (router5 && typeof router5 === "function" && Array.isArray((router5 as Record<string, unknown>).stack)) {
    return (router5 as Record<string, unknown>).stack as Array<Record<string, unknown>>;
  }
  if (router5 && typeof router5 === "object" && Array.isArray(router5.stack)) {
    return router5.stack as Array<Record<string, unknown>>;
  }

  // Express 4: app._router.stack
  const router4 = app._router as Record<string, unknown> | undefined;
  if (router4 && Array.isArray(router4.stack)) {
    return router4.stack as Array<Record<string, unknown>>;
  }

  return null;
}

async function main(): Promise<void> {
  const entryPath = process.argv[2];

  if (!entryPath) {
    const error: IntrospectError = { error: "No entry point provided", code: "no-entry" };
    process.stderr.write(JSON.stringify(error));
    process.exit(1);
  }

  const absoluteEntry = resolve(entryPath);
  const entryUrl = pathToFileURL(absoluteEntry).href;

  let moduleExports: Record<string, unknown>;
  try {
    moduleExports = (await import(entryUrl)) as Record<string, unknown>;
  } catch (err) {
    const error: IntrospectError = {
      error: `Failed to import: ${err instanceof Error ? err.message : String(err)}`,
      code: "import-failed",
    };
    process.stderr.write(JSON.stringify(error));
    process.exit(1);
  }

  const app = findExpressApp(moduleExports);
  if (!app) {
    const error: IntrospectError = {
      error: "No Express app export found (checked: default, app, createApp)",
      code: "no-app-export",
    };
    process.stderr.write(JSON.stringify(error));
    process.exit(1);
  }

  const stack = getRouterStack(app);
  if (!stack) {
    const error: IntrospectError = {
      error: "Express app found but router stack is not accessible",
      code: "no-router-stack",
    };
    process.stderr.write(JSON.stringify(error));
    process.exit(1);
  }

  const endpoints = walkStack(stack, "");

  const result: IntrospectResult = {
    endpoints,
    framework: "express",
  };

  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

main().catch((err) => {
  const error: IntrospectError = {
    error: `Unexpected: ${err instanceof Error ? err.message : String(err)}`,
    code: "unexpected",
  };
  process.stderr.write(JSON.stringify(error));
  process.exit(1);
});
