/**
 * Init orchestration for `dt init`.
 *
 * Manual-scope: `dt init --components` (S-017)
 * Task-scope:   `dt init --task` (S-020) — full pipeline per spec §8.4
 *
 * Orchestrates: meta-repo pin → freshness check → [candidates → LLM scope →
 * closure → gate] → fetch per-component repos → assemble bundle → emit session.lock.json.
 *
 * Spec: §5.6 + §6.5 + §8.4 (RF-30, RF-31, RF-38, RF-39).
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parse as yamlParse } from "yaml";

import type { CatalogIndex } from "../catalog/index-model.js";
import { catalogResolve } from "../catalog/resolve.js";
import type {
  BundleManifest,
  ComponentContent,
  ContractFile,
  MetaRepoContent,
  ScopeInput,
} from "./assemble.js";
import { assemble, DEFAULT_BUDGET } from "./assemble.js";
import { ctxFetch, type FetchTarget } from "./fetch.js";
import {
  buildSessionLock,
  writeSessionLock,
  type SessionLock,
  type ReviewFlag,
} from "./session-lock.js";
import { runScoping } from "../scope/scoping.js";
import { expandClosure } from "../scope/closure.js";
import { runGate } from "../scope/gate.js";
import type { LlmScopeProvider, ScopeOutput } from "../scope/types.js";
import type { ClosureResult } from "../scope/closure.js";
import type { GateResult } from "../scope/gate.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface InitOptions {
  /** Component ids to include in scope (manual scope) */
  components: string[];
  /** Path to the meta-repo root */
  metaRepoPath: string;
  /** Output directory for the bundle and session lock */
  outDir: string;
  /** Maximum allowed index age in minutes (default: 240) */
  maxIndexAge?: number;
  /** Token budget for the bundle (default: 60000) */
  budget?: number;
  /** Override cache base directory (for testing) */
  cacheBaseDir?: string;
  /** Concurrency for fetch (default: 8) */
  concurrency?: number;
}

export interface InitResult {
  /** The session lock that was emitted */
  sessionLock: SessionLock;
  /** The bundle manifest */
  bundleManifest: BundleManifest;
  /** Path to the session lock file */
  lockFilePath: string;
  /** Meta-repo SHA that was pinned */
  metaRepoSha: string;
  /** Index age in minutes */
  indexAgeMinutes: number;
}

export interface InitWithTaskOptions {
  /** Natural-language task description */
  task: string;
  /** Path to the meta-repo root */
  metaRepoPath: string;
  /** Output directory for the bundle and session lock */
  outDir: string;
  /** Maximum allowed index age in minutes (default: 240) */
  maxIndexAge?: number;
  /** Token budget for the bundle (default: 60000) */
  budget?: number;
  /** Maximum total components (primary + secondary) for gate G1 (default: 4) */
  maxComponents?: number;
  /** Flow id to guide scoping */
  flow?: string;
  /** Override cache base directory (for testing) */
  cacheBaseDir?: string;
  /** Concurrency for fetch (default: 8) */
  concurrency?: number;
  /** LLM provider for the scoping call */
  llmProvider: LlmScopeProvider;
  /** If true, skip writing calibration data */
  skipCalibration?: boolean;
}

export interface InitWithTaskResult {
  /** The session lock that was emitted */
  session: SessionLock;
  /** The bundle manifest */
  bundle: BundleManifest;
  /** Scope output from the LLM */
  scope: ScopeOutput;
  /** Review flags from the gate (G5-G7 warnings) */
  review_flags: ReviewFlag[];
  /** Path to the session lock file */
  lockFilePath: string;
  /** Meta-repo SHA that was pinned */
  metaRepoSha: string;
  /** Index age in minutes */
  indexAgeMinutes: number;
}

/** Error class for stale index (exit 9 in the spec context) */
export class StaleIndexError extends Error {
  public readonly ageMinutes: number;
  public readonly maxMinutes: number;

  constructor(ageMinutes: number, maxMinutes: number) {
    super(`Catalog index is stale: ${ageMinutes} minutes old (max allowed: ${maxMinutes} minutes)`);
    this.name = "StaleIndexError";
    this.ageMinutes = ageMinutes;
    this.maxMinutes = maxMinutes;
  }
}

/** Error class for unknown component id (exit 12 in the spec context) */
export class UnknownComponentError extends Error {
  public readonly unknownIds: string[];

  constructor(unknownIds: string[]) {
    super(`Unknown component(s): ${unknownIds.join(", ")}`);
    this.name = "UnknownComponentError";
    this.unknownIds = unknownIds;
  }
}

/** Error class for missing meta-repo (not a git repo) */
export class MetaRepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaRepoError";
  }
}

/** Error class for --no-llm without --components (exit 2) */
export class NoLlmWithoutComponentsError extends Error {
  constructor() {
    super("--no-llm requires --components to specify scope explicitly");
    this.name = "NoLlmWithoutComponentsError";
  }
}

/** Error class for no candidates from lexical resolve (exit 11) */
export class NoCandidatesError extends Error {
  public readonly taskText: string;

  constructor(taskText: string) {
    super(`No candidates found for task: "${taskText}"`);
    this.name = "NoCandidatesError";
    this.taskText = taskText;
  }
}

/** Error class for gate abort (exit 7) — system decision, not an error */
export class GateAbortError extends Error {
  public readonly abortRule: string;
  public readonly reviewFlags: Array<{ rule: string; message: string }>;

  constructor(
    abortReason: string,
    abortRule: string,
    reviewFlags: Array<{ rule: string; message: string }>,
  ) {
    super(`Gate aborted (${abortRule}): ${abortReason}`);
    this.name = "GateAbortError";
    this.abortRule = abortRule;
    this.reviewFlags = reviewFlags;
  }
}

/** Error class for invalid scope after LLM retry (exit 10) */
export class InvalidScopeError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid scope after retry: ${errors.join("; ")}`);
    this.name = "InvalidScopeError";
    this.errors = errors;
  }
}

/* ─── Constants ───────────────────────────────────────────────────────── */

/** Default max index age in minutes */
export const DEFAULT_MAX_INDEX_AGE = 240;

/* ─── Core Logic ──────────────────────────────────────────────────────── */

/**
 * Resolve the meta-repo to a git SHA (pin for the session).
 * Throws MetaRepoError if path is not a git repo.
 */
export function resolveMetaRepoSha(metaRepoPath: string): string {
  const absPath = resolve(metaRepoPath);

  if (!existsSync(absPath)) {
    throw new MetaRepoError(`Meta-repo path does not exist: ${absPath}`);
  }

  try {
    const sha = execSync("git rev-parse HEAD", {
      cwd: absPath,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    }).trim();

    if (!sha || sha.length < 7) {
      throw new MetaRepoError(`Could not resolve git SHA at: ${absPath}`);
    }

    return sha;
  } catch (err) {
    if (err instanceof MetaRepoError) throw err;
    throw new MetaRepoError(
      `Path is not a git repository: ${absPath} (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

/**
 * Load and validate the catalog index, computing its age.
 * Returns the parsed index and age in minutes.
 * Throws StaleIndexError if the index exceeds maxIndexAge.
 */
export function loadAndCheckIndex(
  metaRepoPath: string,
  maxIndexAge: number,
): { index: CatalogIndex; ageMinutes: number } {
  const indexPath = resolve(metaRepoPath, "catalog", "index.yaml");

  if (!existsSync(indexPath)) {
    throw new MetaRepoError(`Catalog index not found: ${indexPath}`);
  }

  const indexContent = readFileSync(indexPath, "utf-8");
  const index = yamlParse(indexContent) as CatalogIndex;

  if (!index.generated_at) {
    throw new MetaRepoError(`Catalog index missing 'generated_at' field: ${indexPath}`);
  }

  const generatedAt = new Date(index.generated_at);
  const now = new Date();
  const ageMinutes = Math.floor((now.getTime() - generatedAt.getTime()) / (60 * 1000));

  if (ageMinutes > maxIndexAge) {
    throw new StaleIndexError(ageMinutes, maxIndexAge);
  }

  return { index, ageMinutes };
}

/**
 * Validate that all requested component ids exist in the catalog index.
 * Throws UnknownComponentError if any id is not found.
 */
export function validateComponents(components: string[], index: CatalogIndex): void {
  const knownIds = new Set(index.components.map((c) => c.id));
  const unknown = components.filter((id) => !knownIds.has(id));

  if (unknown.length > 0) {
    throw new UnknownComponentError(unknown);
  }
}

/**
 * Build fetch targets from component ids using the catalog index.
 */
export function buildFetchTargets(components: string[], index: CatalogIndex): FetchTarget[] {
  const targets: FetchTarget[] = [];

  for (const id of components) {
    const comp = index.components.find((c) => c.id === id);
    if (!comp) continue; // already validated

    const url = comp.repo;
    const sha = comp.origin_sha;

    // Parse host/org/repo from URL
    const parsed = parseRepoUrl(url);

    targets.push({
      id,
      url,
      sha,
      host: parsed.host,
      org: parsed.org,
      repo: parsed.repo,
    });
  }

  return targets;
}

/**
 * Parse a git URL into host/org/repo components.
 */
function parseRepoUrl(url: string): { host: string; org: string; repo: string } {
  // HTTPS format: https://github.com/org/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], org: httpsMatch[2], repo: httpsMatch[3] };
  }

  // SSH format: git@github.com:org/repo.git
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], org: sshMatch[2], repo: sshMatch[3] };
  }

  // File path (local repos for testing): /path/to/repo or file:///path/to/repo
  const cleaned = url.replace(/^file:\/\//, "").replace(/\/$/, "");
  const parts = cleaned.split("/");
  return {
    host: "local",
    org: parts[parts.length - 2] ?? "unknown",
    repo: parts[parts.length - 1] ?? "unknown",
  };
}

/**
 * Run the full init orchestration.
 *
 * Steps:
 * 1. Resolve meta-repo to SHA (pin)
 * 2. Load index and check freshness
 * 3. Validate all component ids
 * 4. Fetch per-component repos
 * 5. Assemble bundle
 * 6. Emit session.lock.json
 */
export async function init(options: InitOptions): Promise<InitResult> {
  const maxIndexAge = options.maxIndexAge ?? DEFAULT_MAX_INDEX_AGE;
  const budget = options.budget ?? DEFAULT_BUDGET;
  const metaRepoPath = resolve(options.metaRepoPath);

  // Step 1: Pin meta-repo
  const metaRepoSha = resolveMetaRepoSha(metaRepoPath);

  // Step 2: Load index and check freshness
  const { index, ageMinutes } = loadAndCheckIndex(metaRepoPath, maxIndexAge);

  // Step 3: Validate components
  validateComponents(options.components, index);

  // Step 4: Fetch per-component repos
  const targets = buildFetchTargets(options.components, index);
  const fetchResult = await ctxFetch({
    metaRepoPath,
    targets,
    concurrency: options.concurrency ?? 8,
    cacheBaseDir: options.cacheBaseDir,
  });

  // Build repo SHAs map from fetch results
  const repoShas: Record<string, string> = {};
  for (const entry of fetchResult.entries) {
    if (!entry.error) {
      const target = targets.find((t) => t.id === entry.id);
      if (target) {
        repoShas[entry.id] = target.sha;
      }
    }
  }

  // Step 5: Assemble bundle
  // Build scope input for assemble — for manual scope, all components are primary
  const scopeInput: ScopeInput = {
    primary: options.components,
    secondary: [],
    contracts_crossed: collectContractsCrossed(options.components, index),
    confidence: "manual",
  };

  // Build component content map from cache paths
  const componentContent = buildComponentContentFromCache(fetchResult, index);

  const metaRepoContent = loadMetaRepoForAssembly(metaRepoPath, index, componentContent);

  const bundleManifest = assemble({
    scope: scopeInput,
    metaRepo: metaRepoContent,
    outDir: resolve(options.outDir),
    budget,
  });

  // Step 6: Emit session lock
  const sessionLock = buildSessionLock({
    components: options.components,
    source: "manual",
    metaRepoSha,
    indexAgeMinutes: ageMinutes,
    repoShas,
    bundleManifest,
  });

  const lockFilePath = writeSessionLock(resolve(options.outDir), sessionLock);

  return {
    sessionLock,
    bundleManifest,
    lockFilePath,
    metaRepoSha,
    indexAgeMinutes: ageMinutes,
  };
}

/**
 * Run the full --task init orchestration per spec §8.4.
 *
 * Steps:
 * 1. Resolve meta-repo to SHA (pin)
 * 2. Load index and check freshness → exit 9 if stale
 * 3. Run lexical candidates (catalogResolve) → exit 11 if empty
 * 4. Call LLM scoping (with repair retry) → exit 10 if invalid after retry
 * 5. Expand scope via graph closure
 * 6. Validate all scope ids exist → exit 12 if unknown
 * 7. Run gate → exit 7 if abort
 * 8. Fetch per-component repos
 * 9. Assemble bundle → exit 6 if budget exceeded
 * 10. Emit session.lock.json with review_flags
 */
export async function initWithTask(options: InitWithTaskOptions): Promise<InitWithTaskResult> {
  const maxIndexAge = options.maxIndexAge ?? DEFAULT_MAX_INDEX_AGE;
  const budget = options.budget ?? DEFAULT_BUDGET;
  const maxComponents = options.maxComponents ?? 4;
  const metaRepoPath = resolve(options.metaRepoPath);

  // Step 1: Pin meta-repo
  const metaRepoSha = resolveMetaRepoSha(metaRepoPath);

  // Step 2: Load index and check freshness (throws StaleIndexError → exit 9)
  const { index, ageMinutes } = loadAndCheckIndex(metaRepoPath, maxIndexAge);

  // Step 3: Lexical candidates
  const candidates = catalogResolve(index, options.task, { limit: 12 });
  if (candidates.length === 0) {
    throw new NoCandidatesError(options.task);
  }

  // Step 4: LLM scoping (with one repair retry)
  const scopingResult = await runScoping({
    taskText: options.task,
    candidates,
    index,
    llmProvider: options.llmProvider,
    skipCalibration: options.skipCalibration,
  });

  if (!scopingResult.success) {
    throw new InvalidScopeError(scopingResult.errors);
  }

  const scopeOutput: ScopeOutput = scopingResult.output;

  // Inject flow if specified via CLI flag and not set by LLM
  if (options.flow && !scopeOutput.flow) {
    scopeOutput.flow = options.flow;
  }

  // Step 5: Graph closure
  const closureResult: ClosureResult = expandClosure(scopeOutput, index);

  // Step 6: Validate all scope ids exist in the index
  const allScopeIds = [...closureResult.primary, ...closureResult.secondary];
  const unknownIds = allScopeIds.filter((id) => !index.components.some((c) => c.id === id));
  if (unknownIds.length > 0) {
    throw new UnknownComponentError(unknownIds);
  }

  // Step 7: Run gate
  const gateResult: GateResult = runGate(scopeOutput, closureResult, index, { maxComponents });
  if (!gateResult.passed) {
    throw new GateAbortError(gateResult.abortReason, gateResult.abortRule, gateResult.reviewFlags);
  }

  const reviewFlags: ReviewFlag[] = gateResult.reviewFlags.map((v) => ({
    rule: v.rule,
    message: v.message,
  }));

  // Step 8: Fetch per-component repos
  const targets = buildFetchTargets(allScopeIds, index);
  const fetchResult = await ctxFetch({
    metaRepoPath,
    targets,
    concurrency: options.concurrency ?? 8,
    cacheBaseDir: options.cacheBaseDir,
  });

  // Build repo SHAs map from fetch results
  const repoShas: Record<string, string> = {};
  for (const entry of fetchResult.entries) {
    if (!entry.error) {
      const target = targets.find((t) => t.id === entry.id);
      if (target) {
        repoShas[entry.id] = target.sha;
      }
    }
  }

  // Step 9: Assemble bundle (throws BudgetExceededError → exit 6)
  const scopeInput: ScopeInput = {
    primary: closureResult.primary,
    secondary: closureResult.secondary,
    contracts_crossed: scopeOutput.contracts_crossed,
    confidence: scopeOutput.confidence,
  };

  const componentContent = buildComponentContentFromCache(fetchResult, index);
  const metaRepoContent = loadMetaRepoForAssembly(metaRepoPath, index, componentContent);

  const bundleManifest = assemble({
    scope: scopeInput,
    metaRepo: metaRepoContent,
    outDir: resolve(options.outDir),
    budget,
  });

  // Step 10: Emit session lock with review_flags
  const allComponents = [...closureResult.primary, ...closureResult.secondary];
  const sessionLock = buildSessionLock({
    components: allComponents,
    source: "llm",
    metaRepoSha,
    indexAgeMinutes: ageMinutes,
    repoShas,
    bundleManifest,
    taskText: options.task,
    primary: closureResult.primary,
    secondary: closureResult.secondary,
    contractsCrossed: scopeOutput.contracts_crossed,
    confidence: scopeOutput.confidence,
    flow: scopeOutput.flow,
    reviewFlags,
  });

  const lockFilePath = writeSessionLock(resolve(options.outDir), sessionLock);

  return {
    session: sessionLock,
    bundle: bundleManifest,
    scope: scopeOutput,
    review_flags: reviewFlags,
    lockFilePath,
    metaRepoSha,
    indexAgeMinutes: ageMinutes,
  };
}

/* ─── Internal Helpers ────────────────────────────────────────────────── */

/**
 * Collect contracts crossed by the given component set.
 * A contract is "crossed" if it is consumed by a component in the set
 * but provided by a component outside the set.
 */
function collectContractsCrossed(components: string[], index: CatalogIndex): string[] {
  const inScope = new Set(components);
  const crossed: string[] = [];

  for (const comp of index.components) {
    if (!inScope.has(comp.id)) continue;
    for (const consumed of comp.consumes) {
      // Find the provider of this contract
      const provider = index.components.find((c) =>
        c.provides.some((p) => p.id === consumed.contract),
      );
      if (provider && !inScope.has(provider.id)) {
        crossed.push(consumed.contract);
      }
    }
  }

  // Deduplicate
  return [...new Set(crossed)];
}

/**
 * Build component content from cache paths.
 */
function buildComponentContentFromCache(
  fetchResult: Awaited<ReturnType<typeof ctxFetch>>,
  index: CatalogIndex,
): Map<string, ComponentContent> {
  const componentContentMap = new Map<string, ComponentContent>();

  for (const entry of fetchResult.entries) {
    if (entry.error) continue;

    const comp = index.components.find((c) => c.id === entry.id);
    if (!comp) continue;

    let docs = "";
    const contracts: ContractFile[] = [];

    // Read docs from cache
    const docsDir = resolve(entry.cachePath, "docs");
    if (existsSync(docsDir)) {
      docs = readDirMarkdownFiles(docsDir);
    }

    // Read contracts from cache
    const contractsDir = resolve(entry.cachePath, "contracts");
    if (existsSync(contractsDir)) {
      const files = readAllDirFiles(contractsDir);
      for (const [filename, content] of files) {
        const contractId = filename.replace(/\.[^.]+$/, "");
        const provideEntry = comp.provides.find((p) => p.id === contractId);
        contracts.push({
          id: contractId,
          content,
          confidence: provideEntry?.confidence ?? "unknown",
        });
      }
    }

    componentContentMap.set(entry.id, { docs, contracts });
  }

  return componentContentMap;
}

/**
 * Load meta-repo content for assembly.
 */
function loadMetaRepoForAssembly(
  metaRepoPath: string,
  index: CatalogIndex,
  componentContent: Map<string, ComponentContent>,
): MetaRepoContent {
  let architectureMd: string | undefined;
  const archPath = resolve(metaRepoPath, "architecture.md");
  if (existsSync(archPath)) {
    architectureMd = readFileSync(archPath, "utf-8");
  }

  let conventionsMd: string | undefined;
  const convPath = resolve(metaRepoPath, "conventions.md");
  if (existsSync(convPath)) {
    conventionsMd = readFileSync(convPath, "utf-8");
  }

  // Load flow content
  const flowContent = new Map<string, string>();
  const flowDir = resolve(metaRepoPath, "catalog", "flows");
  if (existsSync(flowDir)) {
    const files = readdirSync(flowDir);
    for (const file of files) {
      const filePath = resolve(flowDir, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        const id = file.replace(/\.[^.]+$/, "");
        flowContent.set(id, readFileSync(filePath, "utf-8"));
      }
    }
  }

  return {
    basePath: metaRepoPath,
    index,
    architectureMd,
    conventionsMd,
    componentContent,
    flowContent: flowContent.size > 0 ? flowContent : undefined,
  };
}

/**
 * Read all markdown files in a directory, concatenated.
 */
function readDirMarkdownFiles(dir: string): string {
  const parts: string[] = [];
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const file of files) {
      const filePath = resolve(dir, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        parts.push(readFileSync(filePath, "utf-8"));
      }
    }
  } catch {
    // ignore
  }
  return parts.join("\n\n");
}

/**
 * Read all files in a directory as [filename, content] pairs.
 */
function readAllDirFiles(dir: string): [string, string][] {
  const result: [string, string][] = [];
  try {
    const files = readdirSync(dir).sort();
    for (const file of files) {
      const filePath = resolve(dir, file);
      const stat = statSync(filePath);
      if (stat.isFile()) {
        result.push([file, readFileSync(filePath, "utf-8")]);
      }
    }
  } catch {
    // ignore
  }
  return result;
}
