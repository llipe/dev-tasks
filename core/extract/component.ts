/**
 * Component.yaml derivation + provenance assembly.
 * Spec §8.5 — derives component.yaml fields from detection + extraction outputs,
 * assembles _provenance metadata, and integrates with reconciliation for idempotency.
 *
 * Field categories:
 * - Derivable: directly from detection + extraction (no human/LLM needed)
 * - Inferable: via LLM, requires human confirmation before persisting
 * - Non-derivable: only via interactive prompt (owner, domain, criticality, lifecycle)
 */

import { hashContent } from "#core/distribution/hash.js";
import { reconcile, type ReconcileAction } from "#core/reconcile.js";
import type { DetectionResult } from "./provider.js";

/**
 * Confidence levels for provenance tracking.
 */
export type Confidence = "high" | "medium" | "low";

/**
 * Source of a field value.
 */
export type FieldSource = "detected" | "extracted" | "inferred" | "prompted" | "default";

/**
 * Per-field provenance entry.
 */
export interface FieldProvenance {
  source: FieldSource;
  confidence: Confidence;
  confirmed_by?: string;
}

/**
 * The _provenance block embedded inside component.yaml.
 */
export interface ProvenanceBlock {
  extracted_at: string;
  extractor: string;
  repo_sha: string;
  detector: DetectionResult | null;
  fields: Record<string, FieldProvenance>;
  field_hashes: Record<string, string>;
}

/**
 * A provides entry in component.yaml.
 */
export interface ProvidesEntry {
  path: string;
  method?: string;
  source?: string;
  confidence?: Confidence;
}

/**
 * A consumes entry in component.yaml.
 */
export interface ConsumesEntry {
  service: string;
  protocol?: string;
  criticality?: string;
}

/**
 * The component.yaml data structure.
 */
export interface ComponentYaml {
  name: string;
  stack: string[];
  type: string;
  description: string;
  aliases: string[];
  owner: string;
  domain: string;
  subdomain: string;
  criticality: string;
  lifecycle: string;
  provides: ProvidesEntry[];
  consumes: ConsumesEntry[];
  datastores: string[];
  paths: string[];
  docs: {
    schema?: string;
    openapi?: string;
    asyncapi?: string;
  };
  _provenance: ProvenanceBlock;
}

/**
 * Field category classification.
 */
export type FieldCategory = "derivable" | "inferable" | "non-derivable";

/**
 * Field category map — defines how each top-level field is populated.
 */
export const FIELD_CATEGORIES: Record<string, FieldCategory> = {
  name: "derivable",
  stack: "derivable",
  type: "derivable",
  provides: "derivable",
  datastores: "derivable",
  paths: "derivable",
  docs: "derivable",
  consumes: "derivable",
  description: "inferable",
  aliases: "inferable",
  subdomain: "inferable",
  owner: "non-derivable",
  domain: "non-derivable",
  criticality: "non-derivable",
  lifecycle: "non-derivable",
};

/**
 * Inputs from prior extraction steps used to derive component fields.
 */
export interface ExtractionInputs {
  detection: DetectionResult | null;
  schemaResult: SchemaExtractionInput | null;
  openApiResult: OpenApiExtractionInput | null;
  asyncApiResult: AsyncApiExtractionInput | null;
  repoName: string;
  repoSha: string;
  extractorVersion: string;
}

export interface SchemaExtractionInput {
  tables: string[];
  filePath?: string;
}

export interface OpenApiExtractionInput {
  endpoints: Array<{ method: string; path: string }>;
  filePath?: string;
}

export interface AsyncApiExtractionInput {
  topics: Array<{ name: string; direction: "provides" | "consumes" }>;
  filePath?: string;
}

/**
 * LLM inference results for inferable fields.
 */
export interface InferenceResult {
  description: string;
  aliases: string[];
  subdomain: string;
  consumesCriticality: Record<string, string>;
}

/**
 * Prompted values for non-derivable fields.
 */
export interface PromptedValues {
  owner: string;
  domain: string;
  criticality: string;
  lifecycle: string;
}

/**
 * Options for component derivation.
 */
export interface DeriveComponentOptions {
  inputs: ExtractionInputs;
  inference: InferenceResult | null;
  prompted: PromptedValues;
  confirmed: ConfirmationResult;
}

/**
 * Result of human confirmation for inferable fields.
 */
export interface ConfirmationResult {
  description: boolean;
  aliases: boolean;
  subdomain: boolean;
  consumesCriticality: boolean;
}

/**
 * Derive all derivable fields from extraction inputs.
 */
export function deriveFields(inputs: ExtractionInputs): Partial<ComponentYaml> {
  const { detection, schemaResult, openApiResult, asyncApiResult, repoName } = inputs;

  const stack = detection?.stack ?? [];
  const type = detection?.type_hint ?? "unknown";
  const name = repoName;

  // Derive provides from OpenAPI endpoints
  const provides: ProvidesEntry[] = [];
  if (openApiResult) {
    for (const ep of openApiResult.endpoints) {
      provides.push({ path: ep.path, method: ep.method });
    }
  }

  // Derive datastores from schema tables
  const datastores: string[] = schemaResult?.tables ?? [];

  // Derive paths (source directories that were scanned)
  const paths = ["src/"];

  // Derive docs references
  const docs: ComponentYaml["docs"] = {};
  if (schemaResult?.filePath) docs.schema = schemaResult.filePath;
  if (openApiResult?.filePath) docs.openapi = openApiResult.filePath;
  if (asyncApiResult?.filePath) docs.asyncapi = asyncApiResult.filePath;

  // Derive consumes from asyncapi topics where direction is "consumes"
  const consumes: ConsumesEntry[] = [];
  if (asyncApiResult) {
    for (const topic of asyncApiResult.topics) {
      if (topic.direction === "consumes") {
        consumes.push({ service: topic.name, protocol: "kafka" });
      }
    }
  }

  return {
    name,
    stack,
    type,
    provides,
    datastores,
    paths,
    docs,
    consumes,
  };
}

/**
 * Apply inferable fields (only if confirmed by human).
 */
export function applyInference(
  partial: Partial<ComponentYaml>,
  inference: InferenceResult | null,
  confirmed: ConfirmationResult,
): Partial<ComponentYaml> {
  if (!inference) return partial;

  const result = { ...partial };

  if (confirmed.description) {
    result.description = inference.description;
  }

  if (confirmed.aliases) {
    result.aliases = inference.aliases;
  }

  if (confirmed.subdomain) {
    result.subdomain = inference.subdomain;
  }

  if (confirmed.consumesCriticality && result.consumes) {
    result.consumes = result.consumes.map((c) => ({
      ...c,
      criticality: inference.consumesCriticality[c.service] ?? c.criticality,
    }));
  }

  return result;
}

/**
 * Apply prompted values for non-derivable fields.
 */
export function applyPrompted(
  partial: Partial<ComponentYaml>,
  prompted: PromptedValues,
): Partial<ComponentYaml> {
  return {
    ...partial,
    owner: prompted.owner,
    domain: prompted.domain,
    criticality: prompted.criticality,
    lifecycle: prompted.lifecycle,
  };
}

/**
 * Compute SHA-256 hash for each field value (serialized as JSON).
 */
export function computeFieldHashes(component: Partial<ComponentYaml>): Record<string, string> {
  const hashes: Record<string, string> = {};

  for (const [key, value] of Object.entries(component)) {
    if (key === "_provenance") continue;
    if (value === undefined || value === "") continue;
    hashes[key] = hashContent(JSON.stringify(value));
  }

  return hashes;
}

/**
 * Assemble the _provenance block.
 */
export function assembleProvenance(
  inputs: ExtractionInputs,
  component: Partial<ComponentYaml>,
  inference: InferenceResult | null,
  confirmed: ConfirmationResult,
  prompted: PromptedValues,
): ProvenanceBlock {
  const fields: Record<string, FieldProvenance> = {};

  // Derivable fields
  for (const key of [
    "name",
    "stack",
    "type",
    "provides",
    "datastores",
    "paths",
    "docs",
    "consumes",
  ]) {
    if (component[key as keyof ComponentYaml] !== undefined) {
      fields[key] = { source: "detected", confidence: "high" };
    }
  }

  // Inferable fields
  if (inference) {
    if (confirmed.description && component.description) {
      fields.description = { source: "inferred", confidence: "medium", confirmed_by: "human" };
    }
    if (confirmed.aliases && component.aliases && component.aliases.length > 0) {
      fields.aliases = { source: "inferred", confidence: "medium", confirmed_by: "human" };
    }
    if (confirmed.subdomain && component.subdomain) {
      fields.subdomain = { source: "inferred", confidence: "medium", confirmed_by: "human" };
    }
  }

  // Non-derivable fields (prompted)
  for (const key of ["owner", "domain", "criticality", "lifecycle"]) {
    const value = prompted[key as keyof PromptedValues];
    if (value) {
      fields[key] = { source: "prompted", confidence: "high" };
    }
  }

  const fieldHashes = computeFieldHashes(component);

  return {
    extracted_at: new Date().toISOString(),
    extractor: inputs.extractorVersion,
    repo_sha: inputs.repoSha,
    detector: inputs.detection,
    fields,
    field_hashes: fieldHashes,
  };
}

/**
 * Full component derivation pipeline.
 */
export function deriveComponent(options: DeriveComponentOptions): ComponentYaml {
  const { inputs, inference, prompted, confirmed } = options;

  // Step 1: Derive fields from extraction
  let partial = deriveFields(inputs);

  // Step 2: Apply confirmed inferences
  partial = applyInference(partial, inference, confirmed);

  // Step 3: Apply prompted values
  partial = applyPrompted(partial, prompted);

  // Step 4: Assemble provenance
  const provenance = assembleProvenance(inputs, partial, inference, confirmed, prompted);

  return {
    name: partial.name ?? inputs.repoName,
    stack: partial.stack ?? [],
    type: partial.type ?? "unknown",
    description: partial.description ?? "",
    aliases: partial.aliases ?? [],
    owner: partial.owner ?? "",
    domain: partial.domain ?? "",
    subdomain: partial.subdomain ?? "",
    criticality: partial.criticality ?? "",
    lifecycle: partial.lifecycle ?? "",
    provides: partial.provides ?? [],
    consumes: partial.consumes ?? [],
    datastores: partial.datastores ?? [],
    paths: partial.paths ?? [],
    docs: partial.docs ?? {},
    _provenance: provenance,
  };
}

/**
 * Reconcile a component.yaml field against its prior version.
 * Uses the hash-based reconcile engine from core/reconcile.ts.
 *
 * - localHash: current hash of the field in the existing component.yaml on disk
 * - originHash: hash recorded in _provenance.field_hashes at last extraction
 * - newHash: hash of the newly derived value
 *
 * Returns the reconcile action for the field.
 */
export function reconcileField(
  localHash: string | null,
  originHash: string,
  newHash: string,
): ReconcileAction {
  return reconcile(localHash, originHash, newHash);
}

/**
 * Reconcile an entire component.yaml against a prior version on disk.
 * Returns a map of field → action.
 */
export function reconcileComponent(
  existingFieldHashes: Record<string, string> | null,
  provenanceFieldHashes: Record<string, string>,
  newFieldHashes: Record<string, string>,
): Record<string, ReconcileAction> {
  const actions: Record<string, ReconcileAction> = {};
  const allFields = new Set([
    ...Object.keys(provenanceFieldHashes),
    ...Object.keys(newFieldHashes),
  ]);

  for (const field of allFields) {
    const localHash = existingFieldHashes?.[field] ?? null;
    const originHash = provenanceFieldHashes[field] ?? "";
    const newHash = newFieldHashes[field] ?? "";

    if (!localHash && !newHash) continue; // field doesn't exist anywhere

    actions[field] = reconcile(localHash, originHash, newHash);
  }

  return actions;
}

/**
 * Check if any required fields are missing (empty string).
 * Required fields: owner, domain, criticality, lifecycle.
 */
export function getMissingRequiredFields(component: ComponentYaml): string[] {
  const required = ["owner", "domain", "criticality", "lifecycle"] as const;
  const missing: string[] = [];

  for (const field of required) {
    if (!component[field]) {
      missing.push(field);
    }
  }

  return missing;
}
