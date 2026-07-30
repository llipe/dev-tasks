/**
 * Detection orchestrator — loads registered providers, runs detect(), returns first match.
 * Spec §8.1 — deterministic stack/framework/ORM/messaging detection.
 */

import type {
  Capability,
  DetectionResult,
  ExtractionProvider,
  RepoContext,
  RequiresHumanEntry,
} from "./provider.js";

/** Registry of extraction providers, ordered by priority. */
let providers: ExtractionProvider[] = [];

/**
 * Register an extraction provider.
 * Providers are evaluated in registration order; first match wins.
 */
export function registerProvider(provider: ExtractionProvider): void {
  providers.push(provider);
}

/**
 * Clear all registered providers (used in testing).
 */
export function clearProviders(): void {
  providers = [];
}

/**
 * Get the list of registered providers.
 */
export function getProviders(): readonly ExtractionProvider[] {
  return providers;
}

/**
 * Run detection across all registered providers.
 * Returns the DetectionResult from the first matching provider, or null if none match.
 */
export function runDetection(repo: RepoContext): DetectionResult | null {
  for (const provider of providers) {
    const result = provider.detect(repo);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

/**
 * Get the matching provider for a repo (the first whose detect() returns non-null).
 */
export function getMatchingProvider(repo: RepoContext): ExtractionProvider | null {
  for (const provider of providers) {
    const result = provider.detect(repo);
    if (result !== null) {
      return provider;
    }
  }
  return null;
}

/**
 * Given a provider and a list of desired capabilities, compute which artifacts
 * cannot be produced and should be recorded in requires_human.
 *
 * This does NOT throw — missing capabilities are informational, not fatal.
 */
export function getRequiresHuman(
  provider: ExtractionProvider,
  desiredCapabilities: Capability[],
): RequiresHumanEntry[] {
  const entries: RequiresHumanEntry[] = [];

  for (const cap of desiredCapabilities) {
    if (!provider.capabilities.includes(cap)) {
      entries.push({
        artifact: capabilityToArtifact(cap),
        reason: `Provider '${provider.id}' does not declare capability '${cap}'`,
        missing_capability: cap,
      });
    }
  }

  return entries;
}

/**
 * Map a capability to the artifact it would produce.
 */
function capabilityToArtifact(cap: Capability): string {
  switch (cap) {
    case "openapi_native":
      return "openapi.yaml";
    case "openapi_ast":
      return "openapi.yaml";
    case "db_introspection":
      return "schema.md";
    case "orm_ast":
      return "schema.md";
    case "topic_ast":
      return "asyncapi.yaml";
    case "payload_typed":
      return "asyncapi.yaml";
  }
}
