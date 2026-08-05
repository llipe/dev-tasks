/**
 * session.lock.json data model and read/write utilities.
 *
 * The session lock captures everything needed to reproduce a context bundle:
 * - task_hash: SHA-256 of the task text or component list
 * - meta_repo_sha: pinned meta-repo commit SHA
 * - index_age_minutes: age of the catalog index at init time
 * - scope: component ids, primary/secondary split, source, confidence, review_flags
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

/** A review flag surfaced by the gate (G5-G7). */
export interface ReviewFlag {
  rule: string;
  message: string;
}

export interface SessionLock {
  /** SHA-256 hash of the task text or component list that produced this session */
  task_hash: string;
  /** Original task text (when --task was used) */
  task_text?: string;
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
  /** Review flags from the gate (G5-G7 soft warnings). Empty array if none. */
  review_flags: ReviewFlag[];
}

export interface SessionScope {
  /** Component ids in scope (all = primary + secondary, for backward compat) */
  components: string[];
  /** Source of scope: "manual" (from --components) or "llm" (from --task) */
  source: "manual" | "llm";
  /** Primary components (need code changes). Present when source = "llm". */
  primary?: string[];
  /** Secondary components (context only). Present when source = "llm". */
  secondary?: string[];
  /** Contracts crossed by the scope boundary. */
  contracts_crossed?: string[];
  /** Scoping confidence from the LLM. Present when source = "llm". */
  confidence?: "high" | "medium" | "low";
  /** Flow id if the scope was flow-guided. */
  flow?: string;
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
 * Compute task hash from task text (LLM scope).
 * Deterministic: SHA-256 of the raw task text.
 */
export function computeTaskHashFromText(taskText: string): string {
  return createHash("sha256").update(taskText, "utf-8").digest("hex");
}

/**
 * Parameters for building a session lock from the manual-scope pipeline.
 */
export interface BuildSessionLockParams {
  components: string[];
  source: "manual" | "llm";
  metaRepoSha: string;
  indexAgeMinutes: number;
  repoShas: Record<string, string>;
  bundleManifest: BundleManifest;
}

/**
 * Extended parameters for building a session lock from the --task pipeline.
 */
export interface BuildSessionLockWithTaskParams extends BuildSessionLockParams {
  taskText: string;
  primary: string[];
  secondary: string[];
  contractsCrossed: string[];
  confidence: "high" | "medium" | "low";
  flow?: string;
  reviewFlags: ReviewFlag[];
}

/**
 * Build a SessionLock from the assembled bundle and session metadata.
 * Supports both manual scope (backward compat) and LLM scope (extended fields).
 */
export function buildSessionLock(params: BuildSessionLockParams): SessionLock;
export function buildSessionLock(params: BuildSessionLockWithTaskParams): SessionLock;
export function buildSessionLock(
  params: BuildSessionLockParams | BuildSessionLockWithTaskParams,
): SessionLock {
  const { components, source, metaRepoSha, indexAgeMinutes, repoShas, bundleManifest } = params;

  const bundle: SessionBundleEntry[] = bundleManifest.files.map((f: BundleFileEntry) => ({
    filename: f.filename,
    sha256: f.sha256,
    tokens: f.tokens,
  }));

  const isTaskParams = "taskText" in params;

  const taskHash = isTaskParams
    ? computeTaskHashFromText(params.taskText)
    : computeTaskHash(components);

  const scope: SessionScope = {
    components: [...components].sort(),
    source,
  };

  // Add LLM-specific scope fields when available
  if (isTaskParams) {
    scope.primary = params.primary;
    scope.secondary = params.secondary;
    scope.contracts_crossed = params.contractsCrossed;
    scope.confidence = params.confidence;
    if (params.flow) {
      scope.flow = params.flow;
    }
  }

  return {
    task_hash: taskHash,
    task_text: isTaskParams ? params.taskText : undefined,
    meta_repo_sha: metaRepoSha,
    index_age_minutes: indexAgeMinutes,
    scope,
    repo_shas: repoShas,
    bundle,
    total_tokens: bundleManifest.totalTokens,
    created_at: new Date().toISOString(),
    review_flags: isTaskParams ? params.reviewFlags : [],
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
