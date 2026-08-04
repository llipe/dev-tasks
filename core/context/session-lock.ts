/**
 * session.lock.json data model and read/write utilities.
 *
 * The session lock captures everything needed to reproduce a context bundle:
 * - task_hash: SHA-256 of the task text or component list
 * - meta_repo_sha: pinned meta-repo commit SHA
 * - index_age_minutes: age of the catalog index at init time
 * - scope: component ids and source ("manual" or "llm")
 * - repo_shas: per-repo pinned SHAs used during fetch
 * - bundle: file paths, per-file SHA-256, and token counts
 *
 * Spec: §5.6 RF-38.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { BundleManifest, BundleFileEntry } from "./assemble.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface SessionLock {
  /** SHA-256 hash of the task text or component list that produced this session */
  task_hash: string;
  /** Pinned meta-repo git SHA */
  meta_repo_sha: string;
  /** Age of the catalog index (in minutes) at the time of init */
  index_age_minutes: number;
  /** Scope definition */
  scope: SessionScope;
  /** Per-repo SHAs used during fetch */
  repo_shas: Record<string, string>;
  /** Bundle file manifest (filenames, per-file SHA-256, token counts) */
  bundle: SessionBundleEntry[];
  /** Total token count for the bundle */
  total_tokens: number;
  /** Timestamp of session creation (ISO 8601) */
  created_at: string;
}

export interface SessionScope {
  /** Component ids in scope */
  components: string[];
  /** Source of scope: "manual" (from --components) or "llm" */
  source: "manual" | "llm";
}

export interface SessionBundleEntry {
  /** Filename in the bundle output directory */
  filename: string;
  /** SHA-256 hash of the file content */
  sha256: string;
  /** Token count for this file */
  tokens: number;
}

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Compute task hash from a component list (manual scope).
 * Deterministic: sorted component ids joined by comma, then SHA-256.
 */
export function computeTaskHash(components: string[]): string {
  const normalized = [...components].sort().join(",");
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/**
 * Build a SessionLock from the assembled bundle and session metadata.
 */
export function buildSessionLock(params: {
  components: string[];
  source: "manual" | "llm";
  metaRepoSha: string;
  indexAgeMinutes: number;
  repoShas: Record<string, string>;
  bundleManifest: BundleManifest;
}): SessionLock {
  const { components, source, metaRepoSha, indexAgeMinutes, repoShas, bundleManifest } = params;

  const bundle: SessionBundleEntry[] = bundleManifest.files.map((f: BundleFileEntry) => ({
    filename: f.filename,
    sha256: f.sha256,
    tokens: f.tokens,
  }));

  return {
    task_hash: computeTaskHash(components),
    meta_repo_sha: metaRepoSha,
    index_age_minutes: indexAgeMinutes,
    scope: {
      components: [...components].sort(),
      source,
    },
    repo_shas: repoShas,
    bundle,
    total_tokens: bundleManifest.totalTokens,
    created_at: new Date().toISOString(),
  };
}

/**
 * Write a session lock to disk as session.lock.json.
 * Uses deterministic serialization (sorted keys, 2-space indent).
 */
export function writeSessionLock(outDir: string, lock: SessionLock): string {
  const filePath = join(outDir, "session.lock.json");
  // Use a stable serialization: explicit key order
  const serialized = JSON.stringify(lock, null, 2);
  writeFileSync(filePath, serialized, "utf-8");
  return filePath;
}

/**
 * Read a session lock from disk.
 */
export function readSessionLock(outDir: string): SessionLock {
  const filePath = join(outDir, "session.lock.json");
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as SessionLock;
}
