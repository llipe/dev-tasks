/**
 * Workspace-aware component discovery.
 *
 * Discovers workspace packages in monorepos (pnpm, npm/yarn workspaces)
 * and returns them as component roots for per-package extraction.
 *
 * Falls back to treating the repository root as a single component
 * when no workspace configuration is found.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";

/**
 * A discovered component (workspace package or single-package repo root).
 */
export interface DiscoveredComponent {
  /** Absolute path to the package directory */
  path: string;
  /** Package name from package.json */
  name: string;
  /** Parsed package.json */
  packageJson: Record<string, unknown>;
}

/**
 * Discover components (workspace packages) in a repository.
 *
 * Resolution order:
 * 1. pnpm-workspace.yaml globs
 * 2. package.json `workspaces` field (npm/yarn)
 * 3. Fallback: single component at rootDir
 *
 * Deterministic ordering: alphabetical by resolved path.
 * Workspace root is excluded when it declares no runtime dependencies.
 */
export function discoverComponents(rootDir: string): DiscoveredComponent[] {
  // Try pnpm workspace first
  const pnpmWorkspaces = discoverPnpmWorkspaces(rootDir);
  if (pnpmWorkspaces.length > 0) {
    return filterAndSort(rootDir, pnpmWorkspaces);
  }

  // Try npm/yarn workspaces
  const npmWorkspaces = discoverNpmWorkspaces(rootDir);
  if (npmWorkspaces.length > 0) {
    return filterAndSort(rootDir, npmWorkspaces);
  }

  // Fallback: single package at root
  const rootPkg = readPackageJson(rootDir);
  if (rootPkg) {
    return [
      {
        path: rootDir,
        name: (rootPkg.name as string) || relative(resolve(rootDir, ".."), rootDir),
        packageJson: rootPkg,
      },
    ];
  }

  return [{ path: rootDir, name: "unknown", packageJson: {} }];
}

/**
 * Discover packages from pnpm-workspace.yaml.
 */
function discoverPnpmWorkspaces(rootDir: string): DiscoveredComponent[] {
  const workspaceFile = join(rootDir, "pnpm-workspace.yaml");
  if (!existsSync(workspaceFile)) return [];

  const content = readFileSync(workspaceFile, "utf-8");

  // Simple YAML parsing for the packages field
  // Handles: packages:\n  - "glob"\n  - 'glob'\n  - glob
  const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)*)/);
  if (!packagesMatch) return [];

  const globs: string[] = [];
  const lines = packagesMatch[1].split("\n");
  for (const line of lines) {
    const match = line.match(/^\s+-\s+["']?([^"'\n]+?)["']?\s*$/);
    if (match) {
      globs.push(match[1]);
    }
  }

  return resolveGlobs(rootDir, globs);
}

/**
 * Discover packages from package.json workspaces field.
 */
function discoverNpmWorkspaces(rootDir: string): DiscoveredComponent[] {
  const pkg = readPackageJson(rootDir);
  if (!pkg) return [];

  const workspaces = pkg.workspaces;
  if (!workspaces) return [];

  // workspaces can be an array of globs or an object with packages array
  let globs: string[];
  if (Array.isArray(workspaces)) {
    globs = workspaces as string[];
  } else if (
    typeof workspaces === "object" &&
    Array.isArray((workspaces as Record<string, unknown>).packages)
  ) {
    globs = (workspaces as Record<string, unknown>).packages as string[];
  } else {
    return [];
  }

  return resolveGlobs(rootDir, globs);
}

/**
 * Resolve workspace globs to actual package directories.
 * Supports simple `dir/*` globs (one level of wildcard).
 * Does not recurse into node_modules.
 */
function resolveGlobs(rootDir: string, globs: string[]): DiscoveredComponent[] {
  const components: DiscoveredComponent[] = [];

  for (const glob of globs) {
    if (glob.endsWith("/*") || glob.endsWith("/**")) {
      // Directory wildcard: resolve all subdirectories
      const baseDir = glob.replace(/\/\*\*?$/, "");
      const resolvedBase = resolve(rootDir, baseDir);

      if (!existsSync(resolvedBase)) continue;

      let entries: string[];
      try {
        entries = readdirSync(resolvedBase);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const entryPath = join(resolvedBase, entry);
        try {
          if (!statSync(entryPath).isDirectory()) continue;
        } catch {
          continue;
        }

        const pkg = readPackageJson(entryPath);
        if (pkg) {
          components.push({
            path: entryPath,
            name: (pkg.name as string) || entry,
            packageJson: pkg,
          });
        }
      }
    } else {
      // Exact path
      const resolvedPath = resolve(rootDir, glob);
      if (!existsSync(resolvedPath)) continue;

      const pkg = readPackageJson(resolvedPath);
      if (pkg) {
        components.push({
          path: resolvedPath,
          name: (pkg.name as string) || glob,
          packageJson: pkg,
        });
      }
    }
  }

  return components;
}

/**
 * Filter out workspace root (if no runtime deps) and sort alphabetically by path.
 */
function filterAndSort(rootDir: string, components: DiscoveredComponent[]): DiscoveredComponent[] {
  // Include workspace root only if it has runtime dependencies
  const rootPkg = readPackageJson(rootDir);
  if (rootPkg && hasRuntimeDeps(rootPkg)) {
    const rootAlreadyIncluded = components.some((c) => c.path === rootDir);
    if (!rootAlreadyIncluded) {
      components.push({
        path: rootDir,
        name: (rootPkg.name as string) || "root",
        packageJson: rootPkg,
      });
    }
  }

  // Sort alphabetically by path
  return components.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Check if a package.json has runtime dependencies.
 */
function hasRuntimeDeps(pkg: Record<string, unknown>): boolean {
  const deps = pkg.dependencies as Record<string, unknown> | undefined;
  return !!deps && Object.keys(deps).length > 0;
}

/**
 * Read and parse a package.json from a directory. Returns null on failure.
 */
function readPackageJson(dir: string): Record<string, unknown> | null {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
