/**
 * Meta-repo scaffold generator — `dt catalog scaffold`.
 *
 * Generates the canonical meta-repo directory layout including:
 * architecture.md, domains.md, glossary.md, conventions.md,
 * platform.yaml, registry.yaml, adr/, catalog/, catalog/flows/, schemas/
 *
 * Spec: specification-multi-repo-context.md §4.5 meta-repo layout + §15 CI.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ScaffoldOptions {
  /** Target output directory for the scaffold. Defaults to current directory. */
  outDir: string;
  /** Overwrite existing files if true. Default: false. */
  force?: boolean;
}

export interface ScaffoldResult {
  /** Absolute paths of all files created. */
  created: string[];
  /** Absolute paths of files that were skipped (already existed and force=false). */
  skipped: string[];
  /** Absolute paths of directories created. */
  directories: string[];
}

/* ─── Template Content ────────────────────────────────────────────────── */

const TEMPLATE_FILES: Record<string, string> = {
  "architecture.md": `# Architecture

> Document the high-level architectural overview of the system here.
> Include diagrams, component boundaries, and design principles.

## Overview

<!-- Describe the overall system architecture -->

## Key Decisions

<!-- Reference ADRs for significant architectural decisions -->
`,

  "domains.md": `# Domains

> List and describe the business domains in this system.

| Domain | Description | Owner |
|--------|-------------|-------|
| <!-- domain-name --> | <!-- brief description --> | <!-- team --> |
`,

  "glossary.md": `# Glossary

> Canonical definitions of terms used across the system.

| Term | Definition |
|------|-----------|
| <!-- term --> | <!-- definition --> |
`,

  "conventions.md": `# Conventions

> Shared development and documentation conventions across all repositories.

## Naming

<!-- Naming conventions for services, contracts, fields -->

## Versioning

<!-- Versioning strategy for APIs and schemas -->

## Documentation

<!-- Documentation standards -->
`,

  "platform.yaml": `# Platform configuration
# Describes the deployment platform and shared infrastructure.

platform:
  name: ""
  cloud: ""  # aws | gcp | azure | on-prem
  environments:
    - name: production
      url: ""
    - name: staging
      url: ""
`,

  "registry.yaml": `# Service Registry
# Lists all repositories that contribute component manifests to the catalog.
# Used by \`dt catalog build --registry registry.yaml\`.

repos: []
# Example:
# repos:
#   - id: payment-service
#     url: https://github.com/acme/payment-service.git
#     branch: main
#     path: "."  # path to component.json within the repo
`,
};

/** Directories to create (relative to outDir). */
const SCAFFOLD_DIRS = ["adr", "catalog", "catalog/flows", "catalog/components", "schemas"];

/* ─── Implementation ──────────────────────────────────────────────────── */

/**
 * Generate the meta-repo scaffold.
 *
 * Creates the canonical directory layout and template files.
 * By default, does NOT overwrite existing files (use force=true to override).
 */
export function catalogScaffold(options: ScaffoldOptions): ScaffoldResult {
  const { outDir, force = false } = options;

  const result: ScaffoldResult = {
    created: [],
    skipped: [],
    directories: [],
  };

  // Ensure the output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
    result.directories.push(outDir);
  }

  // Create directories
  for (const dir of SCAFFOLD_DIRS) {
    const dirPath = join(outDir, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      result.directories.push(dirPath);
    }
  }

  // Create .gitkeep files in empty directories to ensure they persist in git
  for (const dir of SCAFFOLD_DIRS) {
    const gitkeepPath = join(outDir, dir, ".gitkeep");
    if (!existsSync(gitkeepPath)) {
      writeFileSync(gitkeepPath, "");
      result.created.push(gitkeepPath);
    } else if (!force) {
      result.skipped.push(gitkeepPath);
    } else {
      writeFileSync(gitkeepPath, "");
      result.created.push(gitkeepPath);
    }
  }

  // Create template files
  for (const [filename, content] of Object.entries(TEMPLATE_FILES)) {
    const filePath = join(outDir, filename);
    if (existsSync(filePath) && !force) {
      result.skipped.push(filePath);
    } else {
      writeFileSync(filePath, content, "utf-8");
      result.created.push(filePath);
    }
  }

  return result;
}
