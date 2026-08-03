/**
 * Types for the generated catalog/index.yaml.
 * Represents the aggregated catalog index produced by `dt catalog build`.
 *
 * Spec: specification-multi-repo-context.md §5.4 (index structure), §6.2 (build).
 */

/* ─── Component Summary ─────────────────────────────────────────────── */

export interface ComponentSummary {
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
  provides: ProvidesSummary[];
  consumes: ConsumesSummary[];
  datastores: string[];
  origin_sha: string;
}

export interface ProvidesSummary {
  id: string;
  kind: string;
  source: string;
  confidence?: string;
  topic_confidence?: string;
  payload_confidence?: string;
}

export interface ConsumesSummary {
  contract: string;
  criticality?: string;
  source?: string;
}

/* ─── Contracts (Inverted Consumer Index) ────────────────────────────── */

/**
 * Map from contract id → contract details + list of consumers.
 */
export interface ContractEntry {
  provider: string;
  kind: string;
  consumers: string[];
}

export type ContractsMap = Record<string, ContractEntry>;

/* ─── Extraction Quality ──────────────────────────────────────────────── */

export interface ExtractionQualityCounts {
  high: number;
  medium: number;
  low: number;
}

export interface ComponentExtractionQuality {
  component_id: string;
  counts: ExtractionQualityCounts;
  unresolved: number;
}

export interface ExtractionQualityAggregate {
  total: ExtractionQualityCounts;
  per_component: ComponentExtractionQuality[];
}

/* ─── Domains & Flows ─────────────────────────────────────────────────── */

export interface DomainEntry {
  name: string;
  components: string[];
}

export interface FlowEntry {
  id: string;
  name: string;
  description?: string;
  aliases?: string[];
  participants: string[];
}

/* ─── Build Errors ────────────────────────────────────────────────────── */

export interface BuildError {
  repo: string;
  error: string;
  timestamp: string;
}

/* ─── Catalog Index (top-level) ───────────────────────────────────────── */

export interface CatalogIndex {
  generated_at: string;
  generator: string;
  components: ComponentSummary[];
  contracts: ContractsMap;
  domains: DomainEntry[];
  flows: FlowEntry[];
  extraction_quality: ExtractionQualityAggregate;
  errors: BuildError[];
}

/* ─── Registry (input) ────────────────────────────────────────────────── */

export interface RegistryEntry {
  id: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface Registry {
  entries: RegistryEntry[];
}
