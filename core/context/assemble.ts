/**
 * Layered, budgeted, deterministic context bundle assembler.
 *
 * Builds a fixed-order, budget-capped context bundle with recorded truncation.
 * Deterministic and reproducible: fixed file order, no timestamps, SHA-256 per file.
 *
 * Spec: §6.3 RF-37, RNF-03, RNF-06, O3.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { countTokens, truncateToTokenBudget } from "./tokens.js";
import { renderIndexLayer } from "./layers/index-layer.js";
import { renderFlowLayer } from "./layers/flow-layer.js";
import { renderConventionsDeltaLayer } from "./layers/conventions-delta-layer.js";
import { renderArchitectureLayer } from "./layers/architecture-layer.js";
import { renderPrimaryLayer } from "./layers/primary-layer.js";
import { renderSecondaryLayer } from "./layers/secondary-layer.js";
import { renderContractsLayer } from "./layers/contracts-layer.js";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface ScopeInput {
  /** Primary component ids (1-6) */
  primary: string[];
  /** Secondary component ids (up to 8) */
  secondary: string[];
  /** Contract ids crossed */
  contracts_crossed: string[];
  /** Optional flow id */
  flow?: string;
  /** Confidence of the scope */
  confidence: string;
}

export interface MetaRepoContent {
  /** Path to the meta-repo root */
  basePath: string;
  /** Parsed catalog index (from index.yaml) */
  index: import("../catalog/index-model.js").CatalogIndex;
  /** Architecture.md content (if available) */
  architectureMd?: string;
  /** Conventions.md content (if available) */
  conventionsMd?: string;
  /** Per-component cached content: id → { docs: string, contracts: string[] } */
  componentContent: Map<string, ComponentContent>;
  /** Flow definitions content (if available): id → content */
  flowContent?: Map<string, string>;
}

export interface ComponentContent {
  /** Full docs content (concatenated markdown) */
  docs: string;
  /** Contract file contents */
  contracts: ContractFile[];
}

export interface ContractFile {
  /** Contract id */
  id: string;
  /** Rendered content */
  content: string;
  /** Confidence level */
  confidence: string;
}

export interface AssembleOptions {
  /** Scope from scope-output.json or manual --components */
  scope: ScopeInput;
  /** Meta-repo content (pre-fetched) */
  metaRepo: MetaRepoContent;
  /** Output directory */
  outDir: string;
  /** Total token budget (default: 60000) */
  budget?: number;
}

export interface BundleManifest {
  /** Files in the bundle (fixed order) */
  files: BundleFileEntry[];
  /** Truncation records */
  truncated: TruncationRecord[];
  /** Total token count */
  totalTokens: number;
  /** Budget used */
  budget: number;
}

export interface BundleFileEntry {
  /** Filename in the output directory */
  filename: string;
  /** Layer id */
  layerId: string;
  /** SHA-256 hash of the file content */
  sha256: string;
  /** Token count for this file */
  tokens: number;
}

export interface TruncationRecord {
  /** Layer id that was truncated */
  layerId: string;
  /** Original token count before truncation */
  originalTokens: number;
  /** Token count after truncation */
  truncatedTo: number;
}

/* ─── Layer Definition ────────────────────────────────────────────────── */

export interface LayerDefinition {
  /** Unique layer id */
  id: string;
  /** Filename for the output file */
  filename: string;
  /** Priority: lower number = higher priority (rendered first, truncated last) */
  priority: number;
  /** Whether this layer can be truncated */
  truncable: boolean;
  /** Render function that produces the layer content */
  render: (scope: ScopeInput, metaRepo: MetaRepoContent) => string;
}

/* ─── Constants ───────────────────────────────────────────────────────── */

/** Default token budget */
export const DEFAULT_BUDGET = 60_000;

/* ─── Layer Registry ──────────────────────────────────────────────────── */

/**
 * Build the layer definitions for a given scope.
 * Layers are in fixed order per spec §6.3.
 *
 * Primary components generate individual layer files (04-primary-<id>.md).
 * Secondary components generate individual layer files (05-secondary-<id>.md).
 */
export function buildLayerDefinitions(scope: ScopeInput): LayerDefinition[] {
  const layers: LayerDefinition[] = [
    {
      id: "00-index",
      filename: "00-index.md",
      priority: 0,
      truncable: false,
      render: renderIndexLayer,
    },
    {
      id: "01-flow",
      filename: "01-flow.md",
      priority: 1,
      truncable: false,
      render: renderFlowLayer,
    },
    {
      id: "02-conventions-delta",
      filename: "02-conventions-delta.md",
      priority: 2,
      truncable: false,
      render: renderConventionsDeltaLayer,
    },
    {
      id: "03-architecture",
      filename: "03-architecture.md",
      priority: 3,
      truncable: true,
      render: renderArchitectureLayer,
    },
  ];

  // Primary components — one file per component, higher priority first
  for (let i = 0; i < scope.primary.length; i++) {
    const compId = scope.primary[i];
    layers.push({
      id: `04-primary-${compId}`,
      filename: `04-primary-${compId}.md`,
      priority: 4 + i,
      truncable: true,
      render: (s, m) => renderPrimaryLayer(compId, s, m),
    });
  }

  // Secondary components — one file per component
  for (let i = 0; i < scope.secondary.length; i++) {
    const compId = scope.secondary[i];
    layers.push({
      id: `05-secondary-${compId}`,
      filename: `05-secondary-${compId}.md`,
      priority: 4 + scope.primary.length + i,
      truncable: true,
      render: (s, m) => renderSecondaryLayer(compId, s, m),
    });
  }

  // Contracts layer
  layers.push({
    id: "06-contracts",
    filename: "06-contracts.md",
    priority: 4 + scope.primary.length + scope.secondary.length,
    truncable: true,
    render: renderContractsLayer,
  });

  return layers;
}

/* ─── Assemble ────────────────────────────────────────────────────────── */

/**
 * Assemble the context bundle.
 *
 * 1. Render all layers in fixed order
 * 2. Check non-truncable budget
 * 3. Truncate truncable layers in reverse priority order if over budget
 * 4. Write files to output directory
 * 5. Return deterministic manifest with SHA-256 per file
 *
 * @returns BundleManifest on success, or throws with exit code 6 if non-truncable exceeds budget
 */
export function assemble(options: AssembleOptions): BundleManifest {
  const budget = options.budget ?? DEFAULT_BUDGET;
  const layers = buildLayerDefinitions(options.scope);

  // Step 1: Render all layers
  const rendered: { layer: LayerDefinition; content: string; tokens: number }[] = [];
  for (const layer of layers) {
    const content = layer.render(options.scope, options.metaRepo);
    const tokens = countTokens(content);
    rendered.push({ layer, content, tokens });
  }

  // Step 2: Check non-truncable budget
  const nonTruncableTokens = rendered
    .filter((r) => !r.layer.truncable)
    .reduce((sum, r) => sum + r.tokens, 0);

  if (nonTruncableTokens > budget) {
    throw new BudgetExceededError(
      `Non-truncable layers require ${nonTruncableTokens} tokens but budget is ${budget}. ` +
        `Cannot fit minimum required context.`,
      nonTruncableTokens,
      budget,
    );
  }

  // Step 3: Truncate in reverse priority order if over budget
  const truncated: TruncationRecord[] = [];
  let totalTokens = rendered.reduce((sum, r) => sum + r.tokens, 0);

  if (totalTokens > budget) {
    // Sort truncable layers by priority descending (lowest priority = truncate first)
    const truncableLayers = rendered
      .filter((r) => r.layer.truncable)
      .sort((a, b) => b.layer.priority - a.layer.priority);

    for (const entry of truncableLayers) {
      if (totalTokens <= budget) break;

      const excess = totalTokens - budget;
      const targetTokens = Math.max(0, entry.tokens - excess);
      const originalTokens = entry.tokens;

      if (targetTokens === 0) {
        // Remove entire layer content
        totalTokens -= entry.tokens;
        entry.content = "";
        entry.tokens = 0;
      } else {
        // Truncate to fit
        const result = truncateToTokenBudget(entry.content, targetTokens);
        totalTokens -= entry.tokens - result.tokens;
        entry.content = result.text;
        entry.tokens = result.tokens;
      }

      truncated.push({
        layerId: entry.layer.id,
        originalTokens,
        truncatedTo: entry.tokens,
      });
    }
  }

  // Step 4: Write files to output directory (fixed order)
  mkdirSync(options.outDir, { recursive: true });

  const files: BundleFileEntry[] = [];
  for (const entry of rendered) {
    // Skip empty content (fully truncated layers)
    if (!entry.content && entry.layer.truncable) continue;

    const filePath = join(options.outDir, entry.layer.filename);
    writeFileSync(filePath, entry.content, "utf-8");

    const sha256 = createHash("sha256").update(entry.content, "utf-8").digest("hex");

    files.push({
      filename: entry.layer.filename,
      layerId: entry.layer.id,
      sha256,
      tokens: entry.tokens,
    });
  }

  // Step 5: Write manifest
  const manifest: BundleManifest = {
    files,
    truncated,
    totalTokens: files.reduce((sum, f) => sum + f.tokens, 0),
    budget,
  };

  const manifestPath = join(options.outDir, "bundle.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return manifest;
}

/* ─── Error Types ─────────────────────────────────────────────────────── */

export class BudgetExceededError extends Error {
  public readonly requiredTokens: number;
  public readonly budget: number;

  constructor(message: string, requiredTokens: number, budget: number) {
    super(message);
    this.name = "BudgetExceededError";
    this.requiredTokens = requiredTokens;
    this.budget = budget;
  }
}
