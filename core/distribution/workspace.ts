/**
 * Repository-shape detection and package-map drift (FR-59, PRD AC-29).
 *
 * "Multi-repo" retired with `dt` (D-16). What replaced it is shape: a
 * repository is one package or many, recorded once in `docs/tech.md`'s
 * package map and read by every later phase.
 *
 * SIX SIGNALS, TWO PARSERS. `pnpm-workspace.yaml` and `package.json`
 * `workspaces` are parsed for the package list; `turbo.json`, `nx.json`,
 * `lerna.json`, and `[tool.uv.workspace]` are presence-only. All six
 * answer "is this a monorepo"; only two answer "which packages", and
 * parsing the other four would be four more untested parsers reaching
 * the same conclusion. A repository with only a presence signal gets the
 * shape and an empty list, which is honest — the map is filled at
 * interview time anyway.
 *
 * The YAML is hand-parsed over one key, for the same reason the runbook
 * frontmatter is (D-49): this module is read by `doctor`, which ships to
 * consumers inside `dist/core/`, where devDependencies are absent.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type WorkspaceShape = "single-package" | "monorepo";

export interface WorkspacePackage {
  /** The package's declared name, or null when its package.json has none. */
  name: string | null;
  /** Repo-relative path. "." for the root of a single-package repository. */
  path: string;
  /** Canonical scripts this package actually defines. */
  scripts: string[];
}

export interface Workspace {
  shape: WorkspaceShape;
  /** Every signal file found, sorted — including ones not parsed. */
  signals: string[];
  packages: WorkspacePackage[];
}

export type DriftKind = "missing-row" | "missing-package";

export interface PackageMapDrift {
  kind: DriftKind;
  message: string;
}

/** Presence of any of these means "monorepo", whatever else is true. */
const SIGNAL_FILES = ["pnpm-workspace.yaml", "turbo.json", "nx.json", "lerna.json"];

/** Scripts worth recording in the map, in the order the map lists them. */
const CANONICAL_SCRIPTS = [
  "lint",
  "format:check",
  "typecheck",
  "test",
  "test:unit",
  "test:integration",
  "test:e2e",
  "audit",
  "validate",
];

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read the `packages:` list out of `pnpm-workspace.yaml`.
 * The file has one key that matters and a fixed list shape, so the parse
 * is: find `packages:`, take the `- ...` lines under it.
 */
function readPnpmPatterns(repoRoot: string): string[] {
  const path = join(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync(path)) return [];

  const patterns: string[] = [];
  let inPackages = false;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (/^packages:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const item = line.match(/^\s+-\s*(.+?)\s*$/);
      if (item) {
        patterns.push(item[1].replace(/^["']|["']$/g, ""));
        continue;
      }
      if (line.trim().length > 0) break; // next top-level key
    }
  }
  return patterns;
}

function readNpmPatterns(repoRoot: string): string[] {
  const pkg = readJson(join(repoRoot, "package.json"));
  const workspaces = pkg?.["workspaces"];
  if (Array.isArray(workspaces))
    return workspaces.filter((w): w is string => typeof w === "string");
  return [];
}

/**
 * Expand one workspace pattern to the directories it matches.
 *
 * Supports a literal path, a trailing `/*`, and a trailing `/**`. Those
 * are what `pnpm-workspace.yaml` files use in practice; a pattern with
 * an interior wildcard matches nothing here rather than pulling in a
 * glob dependency for a case no fixture exercises.
 */
function expandPattern(repoRoot: string, pattern: string): string[] {
  const deep = pattern.endsWith("/**");
  const shallow = pattern.endsWith("/*");
  if (!deep && !shallow) {
    return isDirectory(join(repoRoot, pattern)) ? [pattern] : [];
  }

  const base = pattern.slice(0, pattern.lastIndexOf("/"));
  const baseDir = join(repoRoot, base);
  if (!isDirectory(baseDir)) return [];

  const out: string[] = [];
  const walk = (relDir: string, depth: number): void => {
    for (const entry of readdirSync(join(repoRoot, relDir), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const rel = `${relDir}/${entry.name}`;
      out.push(rel);
      if (deep && depth < 8) walk(rel, depth + 1);
    }
  };
  walk(base, 0);
  return out;
}

function readPackage(repoRoot: string, relPath: string): WorkspacePackage | null {
  const manifest = readJson(
    join(repoRoot, relPath === "." ? "package.json" : `${relPath}/package.json`),
  );
  if (manifest === null) return null;

  const scripts = manifest["scripts"];
  const present =
    scripts !== null && typeof scripts === "object"
      ? CANONICAL_SCRIPTS.filter((s) => s in (scripts as Record<string, unknown>))
      : [];

  return {
    name: typeof manifest["name"] === "string" ? manifest["name"] : null,
    path: relPath,
    scripts: present,
  };
}

function hasUvWorkspace(repoRoot: string): boolean {
  const path = join(repoRoot, "pyproject.toml");
  if (!existsSync(path)) return false;
  return /^\[tool\.uv\.workspace\]/m.test(readFileSync(path, "utf-8"));
}

/**
 * Detect the repository's shape and enumerate its packages.
 *
 * A repository with no signal is single-package and gets exactly one
 * row, for its root, so the package map has the same shape either way
 * (AC-3). A path that does not exist reports single-package with no
 * packages rather than throwing: callers include `doctor`, which must
 * survive being pointed at anything.
 */
export function detectWorkspace(repoRoot: string): Workspace {
  const signals = SIGNAL_FILES.filter((f) => existsSync(join(repoRoot, f)));
  if (hasUvWorkspace(repoRoot)) signals.push("pyproject.toml");

  const patterns = [...readPnpmPatterns(repoRoot), ...readNpmPatterns(repoRoot)];
  if (
    patterns.length > 0 &&
    !signals.includes("package.json") &&
    readNpmPatterns(repoRoot).length > 0
  ) {
    signals.push("package.json");
  }

  if (signals.length === 0) {
    const root = readPackage(repoRoot, ".");
    return { shape: "single-package", signals: [], packages: root ? [root] : [] };
  }

  const seen = new Set<string>();
  const packages: WorkspacePackage[] = [];
  for (const pattern of patterns) {
    for (const relPath of expandPattern(repoRoot, pattern)) {
      if (seen.has(relPath)) continue;
      seen.add(relPath);
      const pkg = readPackage(repoRoot, relPath);
      if (pkg !== null) packages.push(pkg);
    }
  }

  return { shape: "monorepo", signals: signals.sort(), packages };
}

/** A row of the package map: its first two columns are what we compare. */
interface MapRow {
  name: string;
  path: string;
}

/**
 * Read the `## Package Map` table out of `docs/tech.md`.
 * Returns null when the section is absent — a repository that has not
 * run `activity-init` yet is not in drift, and warning about a map that
 * was never written would fire on every fresh install.
 */
function readPackageMap(repoRoot: string): MapRow[] | null {
  const path = join(repoRoot, "docs/tech.md");
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  const start = content.search(/^##+\s+Package Map\s*$/m);
  if (start === -1) return null;

  const rest = content.slice(start);
  const end = rest.slice(1).search(/^##\s/m);
  const section = end === -1 ? rest : rest.slice(0, end + 1);

  const rows: MapRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0]) || cells[0].toLowerCase() === "package") continue;
    rows.push({ name: cells[0].replace(/`/g, ""), path: cells[1].replace(/`/g, "") });
  }
  return rows;
}

/**
 * Compare the package map against the workspace, in both directions.
 *
 * Both directions matter, and only one is obvious. A package with no row
 * is the case people look for. A row for a package somebody deleted is
 * the one that rots: the map keeps describing a thing that is gone, and
 * nothing notices until an agent plans work against it.
 *
 * This is a warning surface, never a failure (AC-6). Structural failures
 * belong to `lint` (S-004); the two do not overlap.
 */
export function findPackageMapDrift(repoRoot: string): PackageMapDrift[] {
  const rows = readPackageMap(repoRoot);
  if (rows === null) return [];

  const workspace = detectWorkspace(repoRoot);
  const drift: PackageMapDrift[] = [];

  const mappedPaths = new Set(rows.map((r) => r.path));
  for (const pkg of workspace.packages) {
    if (!mappedPaths.has(pkg.path)) {
      drift.push({
        kind: "missing-row",
        message: `${pkg.name ?? pkg.path} (${pkg.path}) is a workspace package with no row in the docs/tech.md package map.`,
      });
    }
  }

  const realPaths = new Set(workspace.packages.map((p) => p.path));
  for (const row of rows) {
    if (!realPaths.has(row.path)) {
      drift.push({
        kind: "missing-package",
        message: `The docs/tech.md package map has a row for ${row.name} (${row.path}), which is not a workspace package.`,
      });
    }
  }

  return drift;
}
