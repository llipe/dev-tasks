/**
 * Catalog build orchestrator — `dt catalog build`.
 *
 * Aggregates component manifests from a registry into the meta-repo
 * and generates `catalog/index.yaml`. Idempotent: nothing is written
 * when nothing changed. Single repo failure is recorded, not fatal.
 *
 * Spec: specification-multi-repo-context.md §5.4, §6.2 (RF-21, RF-22, RF-25).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";

import type {
  CatalogIndex,
  ComponentSummary,
  ContractsMap,
  DomainEntry,
  FlowEntry,
  ExtractionQualityAggregate,
  ComponentExtractionQuality,
  ExtractionQualityCounts,
  BuildError,
  Registry,
  RegistryEntry,
  ProvidesSummary,
  ConsumesSummary,
} from "./index-model.js";

export type { CatalogIndex, Registry, RegistryEntry };

/* ─── Configuration ───────────────────────────────────────────────────── */

export interface BuildOptions {
  registryPath: string;
  concurrency?: number;
  /** Override the output directory for the catalog. Defaults to sibling of registry. */
  catalogDir?: string;
}

export interface BuildResult {
  index: CatalogIndex;
  written: boolean;
  errors: BuildError[];
}

/* ─── Registry Parsing ────────────────────────────────────────────────── */

/**
 * Parse `registry.yaml` into a typed Registry object.
 * Expected format:
 * ```yaml
 * entries:
 *   - id: payment-service
 *     repo: /path/to/repo   (or git URL)
 *     branch: main          (optional)
 *     path: .               (optional, subpath within repo)
 * ```
 */
export function parseRegistry(registryPath: string): Registry {
  const absPath = resolve(registryPath);
  const raw = readFileSync(absPath, "utf-8");
  const parsed = yamlParse(raw) as Record<string, unknown>;

  if (!parsed || !Array.isArray(parsed.entries)) {
    return { entries: [] };
  }

  const entries: RegistryEntry[] = (parsed.entries as Record<string, unknown>[]).map((e) => ({
    id: String(e.id ?? ""),
    repo: String(e.repo ?? ""),
    branch: e.branch != null ? String(e.branch) : undefined,
    path: e.path != null ? String(e.path) : undefined,
  }));

  return { entries };
}

/* ─── Manifest Mirroring ──────────────────────────────────────────────── */

/**
 * Represents the raw component.json as read from a repo.
 */
interface RawComponentManifest {
  schemaVersion?: string;
  id: string;
  name: string;
  description: string;
  repo: string;
  type: string;
  domain: string;
  subdomain?: string;
  owner: string;
  criticality: string;
  lifecycle: string;
  stack: string[];
  aliases: string[];
  provides: Array<{
    id: string;
    kind: string;
    path?: string;
    source: string;
    confidence?: string;
    topic_confidence?: string;
    payload_confidence?: string;
  }>;
  consumes: Array<{
    contract: string;
    criticality?: string;
    source?: string;
  }>;
  datastores: string[];
  docs: Record<string, string>;
  paths: { source: string[]; root?: string };
  _provenance: {
    extracted_at: string;
    extractor: string;
    repo_sha: string;
    detector?: unknown;
    fields: Record<string, { source: string; confidence: string; confirmed_by?: string }>;
    field_hashes: Record<string, string>;
  };
}

interface FetchedManifest {
  entry: RegistryEntry;
  manifest: RawComponentManifest;
  origin_sha: string;
}

interface FetchError {
  entry: RegistryEntry;
  error: string;
}

/**
 * Fetch manifests from all registry entries.
 * For local paths, reads directly. For now only local paths are supported;
 * remote git fetching will be added in S-015.
 */
export async function fetchManifests(
  registry: Registry,
  registryDir: string,
  _concurrency: number = 8,
): Promise<{ manifests: FetchedManifest[]; errors: FetchError[] }> {
  const manifests: FetchedManifest[] = [];
  const errors: FetchError[] = [];

  // Process entries (sequential for now; concurrency will be added with S-015 sparse-fetch)
  for (const entry of registry.entries) {
    try {
      const result = fetchSingleManifest(entry, registryDir);
      manifests.push(result);
    } catch (err) {
      errors.push({
        entry,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { manifests, errors };
}

function fetchSingleManifest(entry: RegistryEntry, registryDir: string): FetchedManifest {
  // Resolve repo path relative to the registry file directory
  const repoPath = resolve(registryDir, entry.repo);
  const subPath = entry.path ?? ".";

  // Support both component.json and component.yaml
  const jsonPath = join(repoPath, subPath, "component.json");
  const yamlPath = join(repoPath, subPath, "component.yaml");

  let manifestPath: string;
  let format: "json" | "yaml";

  if (existsSync(jsonPath)) {
    manifestPath = jsonPath;
    format = "json";
  } else if (existsSync(yamlPath)) {
    manifestPath = yamlPath;
    format = "yaml";
  } else {
    throw new Error(`component.json/component.yaml not found at ${join(repoPath, subPath)}`);
  }

  const raw = readFileSync(manifestPath, "utf-8");
  let manifest: RawComponentManifest;
  try {
    if (format === "yaml") {
      manifest = yamlParse(raw) as RawComponentManifest;
    } else {
      manifest = JSON.parse(raw) as RawComponentManifest;
    }
  } catch (err) {
    throw new Error(
      `Invalid ${format.toUpperCase()} in ${format === "yaml" ? "component.yaml" : "component.json"}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const origin_sha = manifest._provenance?.repo_sha ?? "unknown";

  return { entry, manifest, origin_sha };
}

/* ─── Mirror manifests to catalog/components/ ─────────────────────────── */

function mirrorManifests(manifests: FetchedManifest[], catalogDir: string): void {
  const componentsDir = join(catalogDir, "components");
  mkdirSync(componentsDir, { recursive: true });

  for (const { manifest } of manifests) {
    const outPath = join(componentsDir, `${manifest.id}.json`);
    writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  }
}

/* ─── Inverted Consumer Index ─────────────────────────────────────────── */

/**
 * Build the inverted consumer index: for each `provides[].id` across all
 * components, record which components consume it.
 */
export function buildContractsMap(manifests: FetchedManifest[]): ContractsMap {
  const contracts: ContractsMap = {};

  // First pass: register all provided contracts
  for (const { manifest } of manifests) {
    for (const p of manifest.provides) {
      if (!contracts[p.id]) {
        contracts[p.id] = {
          provider: manifest.id,
          kind: p.kind,
          consumers: [],
        };
      }
    }
  }

  // Second pass: register consumers
  for (const { manifest } of manifests) {
    for (const c of manifest.consumes) {
      const entry = contracts[c.contract];
      if (entry) {
        if (!entry.consumers.includes(manifest.id)) {
          entry.consumers.push(manifest.id);
        }
      } else {
        // Contract not found in any provider — still record it
        contracts[c.contract] = {
          provider: "unknown",
          kind: "unknown",
          consumers: [manifest.id],
        };
      }
    }
  }

  // Sort consumer lists for determinism
  for (const entry of Object.values(contracts)) {
    entry.consumers.sort();
  }

  return contracts;
}

/* ─── Extraction Quality Tallying ─────────────────────────────────────── */

/**
 * Tally extraction quality across components based on _provenance.fields confidence.
 */
export function tallyExtractionQuality(manifests: FetchedManifest[]): ExtractionQualityAggregate {
  const total: ExtractionQualityCounts = { high: 0, medium: 0, low: 0 };
  const perComponent: ComponentExtractionQuality[] = [];

  for (const { manifest } of manifests) {
    const counts: ExtractionQualityCounts = { high: 0, medium: 0, low: 0 };
    let unresolved = 0;

    const fields = manifest._provenance?.fields ?? {};
    for (const field of Object.values(fields)) {
      const confidence = field.confidence;
      if (confidence === "high") {
        counts.high++;
        total.high++;
      } else if (confidence === "medium") {
        counts.medium++;
        total.medium++;
      } else if (confidence === "low") {
        counts.low++;
        total.low++;
      } else {
        unresolved++;
      }
    }

    perComponent.push({
      component_id: manifest.id,
      counts,
      unresolved,
    });
  }

  // Sort per_component for determinism
  perComponent.sort((a, b) => a.component_id.localeCompare(b.component_id));

  return { total, per_component: perComponent };
}

/* ─── Domains & Flows Aggregation ─────────────────────────────────────── */

/**
 * Aggregate domains from component manifests.
 */
export function aggregateDomains(manifests: FetchedManifest[]): DomainEntry[] {
  const domainMap = new Map<string, string[]>();

  for (const { manifest } of manifests) {
    const domain = manifest.domain;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(manifest.id);
  }

  // Sort domains alphabetically, components within each domain sorted too
  const entries = Array.from(domainMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, components]) => ({
      name,
      components: components.sort(),
    }));

  return entries;
}

/**
 * Aggregate flows from the `catalog/flows/` directory (if it exists).
 */
export function aggregateFlows(catalogDir: string): FlowEntry[] {
  const flowsDir = join(catalogDir, "flows");
  if (!existsSync(flowsDir)) {
    return [];
  }

  const flows: FlowEntry[] = [];

  // Read YAML/JSON flow files from catalog/flows/
  let files: string[];
  try {
    files = readdirSync(flowsDir, "utf-8");
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml") && !file.endsWith(".json")) {
      continue;
    }

    try {
      const raw = readFileSync(join(flowsDir, file), "utf-8");
      let parsed: Record<string, unknown>;
      if (file.endsWith(".json")) {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } else {
        parsed = yamlParse(raw) as Record<string, unknown>;
      }

      if (parsed && typeof parsed.id === "string") {
        flows.push({
          id: parsed.id,
          name: typeof parsed.name === "string" ? parsed.name : parsed.id,
          description: typeof parsed.description === "string" ? parsed.description : undefined,
          participants: Array.isArray(parsed.participants) ? (parsed.participants as string[]) : [],
        });
      }
    } catch {
      // skip malformed flow files
    }
  }

  // Sort for determinism
  flows.sort((a, b) => a.id.localeCompare(b.id));
  return flows;
}

/* ─── Component Summary Builder ───────────────────────────────────────── */

function toComponentSummary(fetched: FetchedManifest): ComponentSummary {
  const { manifest, origin_sha } = fetched;

  const provides: ProvidesSummary[] = manifest.provides.map((p) => {
    const entry: ProvidesSummary = { id: p.id, kind: p.kind, source: p.source };
    if (p.confidence) entry.confidence = p.confidence;
    if (p.topic_confidence) entry.topic_confidence = p.topic_confidence;
    if (p.payload_confidence) entry.payload_confidence = p.payload_confidence;
    return entry;
  });

  const consumes: ConsumesSummary[] = manifest.consumes.map((c) => {
    const entry: ConsumesSummary = { contract: c.contract };
    if (c.criticality) entry.criticality = c.criticality;
    if (c.source) entry.source = c.source;
    return entry;
  });

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    repo: manifest.repo,
    type: manifest.type,
    domain: manifest.domain,
    ...(manifest.subdomain ? { subdomain: manifest.subdomain } : {}),
    owner: manifest.owner,
    criticality: manifest.criticality,
    lifecycle: manifest.lifecycle,
    stack: [...manifest.stack],
    aliases: [...manifest.aliases],
    provides,
    consumes,
    datastores: [...manifest.datastores],
    origin_sha,
  };
}

/* ─── Index Generation ────────────────────────────────────────────────── */

function getGeneratorVersion(): string {
  try {
    let dir = import.meta.dirname;
    for (let i = 0; i < 6; i++) {
      const candidate = join(dir, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
        if (pkg.version) return `dev-tasks@${pkg.version}`;
      } catch {
        // not found, keep going up
      }
      dir = resolve(dir, "..");
    }
  } catch {
    // fallback
  }
  return "dev-tasks@unknown";
}

export function generateIndex(
  manifests: FetchedManifest[],
  catalogDir: string,
  generatedAt?: string,
): CatalogIndex {
  const components = manifests.map(toComponentSummary).sort((a, b) => a.id.localeCompare(b.id));
  const contracts = buildContractsMap(manifests);
  const domains = aggregateDomains(manifests);
  const flows = aggregateFlows(catalogDir);
  const extraction_quality = tallyExtractionQuality(manifests);

  return {
    generated_at: generatedAt ?? new Date().toISOString(),
    generator: getGeneratorVersion(),
    components,
    contracts: sortObjectKeys(contracts),
    domains,
    flows,
    extraction_quality,
    errors: [],
  };
}

/* ─── Deterministic YAML Serialization ────────────────────────────────── */

function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const sorted = Object.keys(obj)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = obj[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );
  return sorted as T;
}

/**
 * Serialize a CatalogIndex to deterministic YAML (sorted keys, stable order).
 */
export function serializeIndex(index: CatalogIndex): string {
  return yamlStringify(index, {
    sortMapEntries: true,
    lineWidth: 0, // no wrapping for determinism
  });
}

/* ─── Idempotent Write ────────────────────────────────────────────────── */

/**
 * Compare generated index content with existing file.
 * Returns true if they are identical (no write needed).
 */
export function isIndexUnchanged(indexPath: string, newContent: string): boolean {
  if (!existsSync(indexPath)) {
    return false;
  }

  try {
    const existing = readFileSync(indexPath, "utf-8");
    return existing === newContent;
  } catch {
    return false;
  }
}

/* ─── Duplicate ID Detection ──────────────────────────────────────────── */

function detectDuplicateIds(manifests: FetchedManifest[]): BuildError[] {
  const seen = new Map<string, string>(); // id → first repo
  const errors: BuildError[] = [];

  for (const { manifest, entry } of manifests) {
    const existing = seen.get(manifest.id);
    if (existing) {
      errors.push({
        repo: entry.repo,
        error: `Duplicate component id "${manifest.id}" — already registered from ${existing}`,
        timestamp: "", // filled by orchestrator
      });
    } else {
      seen.set(manifest.id, entry.repo);
    }
  }

  return errors;
}

/* ─── Main Build Orchestrator ─────────────────────────────────────────── */

/**
 * Execute the catalog build:
 * 1. Parse registry
 * 2. Fetch manifests from all repos
 * 3. Mirror component.json files
 * 4. Generate index.yaml
 * 5. Write if changed (idempotent)
 *
 * Returns the result with exit code semantics:
 * - errors.length === 0 → exit 0
 * - errors.length > 0 → exit 3 (partial failure)
 */
export async function catalogBuild(options: BuildOptions): Promise<BuildResult> {
  const { registryPath, concurrency = 8, catalogDir: catalogDirOverride } = options;

  // Determine catalog output directory
  const registryDir = dirname(resolve(registryPath));
  const catalogDir = catalogDirOverride ?? join(registryDir, "catalog");

  // 1. Parse registry
  const registry = parseRegistry(registryPath);

  // 2. Fetch all manifests
  const { manifests, errors: fetchErrors } = await fetchManifests(
    registry,
    registryDir,
    concurrency,
  );

  // 3. Detect duplicate IDs among successfully fetched manifests
  const duplicateErrors = detectDuplicateIds(manifests);

  // Remove duplicates from manifests (keep first occurrence)
  const seenIds = new Set<string>();
  const deduplicatedManifests = manifests.filter(({ manifest }) => {
    if (seenIds.has(manifest.id)) {
      return false;
    }
    seenIds.add(manifest.id);
    return true;
  });

  // 4. Mirror manifests to catalog/components/
  mirrorManifests(deduplicatedManifests, catalogDir);

  // 5. Generate the index
  // For idempotency: if existing index exists, use its generated_at for comparison
  const indexPath = join(catalogDir, "index.yaml");
  const now = new Date().toISOString();
  let existingGeneratedAt: string | undefined;
  let existingErrors: BuildError[] | undefined;
  if (existsSync(indexPath)) {
    try {
      const existingRaw = readFileSync(indexPath, "utf-8");
      const existingParsed = yamlParse(existingRaw) as Record<string, unknown>;
      if (typeof existingParsed?.generated_at === "string") {
        existingGeneratedAt = existingParsed.generated_at;
      }
      if (Array.isArray(existingParsed?.errors)) {
        existingErrors = existingParsed.errors as BuildError[];
      }
    } catch {
      // ignore parse errors
    }
  }

  // Collect all errors (use stable timestamp for idempotency comparison)
  const allErrors: BuildError[] = [
    ...fetchErrors.map((e) => ({
      repo: e.entry.repo,
      error: e.error,
      timestamp: now,
    })),
    ...duplicateErrors.map((e) => ({ ...e, timestamp: now })),
  ];

  // Compare ignoring timestamps: compare error messages and repos only
  const errorsContentEqual =
    existingErrors !== undefined &&
    existingErrors.length === allErrors.length &&
    existingErrors.every(
      (existing, i) => existing.repo === allErrors[i].repo && existing.error === allErrors[i].error,
    );

  // For idempotency comparison, use existing generated_at and error timestamps
  const index = generateIndex(deduplicatedManifests, catalogDir, existingGeneratedAt ?? now);
  index.errors = errorsContentEqual ? existingErrors! : allErrors;

  // 6. Serialize and check idempotency
  const indexContent = serializeIndex(index);
  const unchanged = isIndexUnchanged(indexPath, indexContent);

  if (!unchanged) {
    // Content actually changed — regenerate with fresh timestamp
    const freshIndex = generateIndex(deduplicatedManifests, catalogDir, now);
    freshIndex.errors = allErrors;
    const freshContent = serializeIndex(freshIndex);
    mkdirSync(dirname(indexPath), { recursive: true });
    writeFileSync(indexPath, freshContent, "utf-8");

    return {
      index: freshIndex,
      written: true,
      errors: allErrors,
    };
  }

  return {
    index,
    written: false,
    errors: allErrors,
  };
}
