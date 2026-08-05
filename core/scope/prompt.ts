/**
 * Scoping prompt template and input assembler.
 *
 * The scoping prompt instructs the LLM to:
 * - Choose only from provided candidates
 * - Use `low` confidence when ambiguous
 * - List unmapped capabilities in `unresolved`
 *
 * The input assembler builds the constrained input containing only:
 * task, candidates, flows, domains (spec §7.1).
 */

import type { ResolveCandidate } from "../catalog/resolve.js";
import type {
  CatalogIndex,
  ComponentSummary,
  DomainEntry,
  FlowEntry,
} from "../catalog/index-model.js";
import type { ScopingInput, ScopingCandidate, ScopingDomain, ScopingFlow } from "./types.js";

/* ─── System Prompt ───────────────────────────────────────────────────── */

/**
 * The system prompt for the scoping LLM call.
 * Instructs the model on constraints and output format.
 */
export const SCOPING_SYSTEM_PROMPT = `You are a code-change scoping assistant. Your task is to determine which components from a service catalog are affected by a given task description.

## Rules

1. **Only choose from the provided candidates list.** Never invent component ids.
2. When ambiguous or uncertain, set confidence to "low".
3. Any capability the task mentions that you cannot map to a candidate MUST be listed in "unresolved".
4. Primary components are those that need a code change. Secondary are needed for understanding context only.
5. Primary: 1 to 6 items. Secondary: 0 to 8 items.
6. Contracts crossed: list contract ids from provides/consumes that the task touches or depends on.
7. Rationale: explain your reasoning in at most 600 characters.

## Output Format

Return a single JSON object conforming to this structure:
{
  "schemaVersion": "1.0.0",
  "primary": ["<component-id>", ...],
  "secondary": ["<component-id>", ...],
  "contracts_crossed": ["<contract-id>", ...],
  "confidence": "high" | "medium" | "low",
  "unresolved": ["<capability-description>", ...],
  "rationale": "<explanation, max 600 chars>",
  "flow": "<optional flow-id>"
}

Return ONLY the JSON object. No markdown, no explanation, no wrapping.`;

/**
 * The repair prompt sent when the first LLM response fails validation.
 */
export const REPAIR_PROMPT_PREFIX = `Your previous response failed validation with the following errors:

`;

export const REPAIR_PROMPT_SUFFIX = `

Please fix the issues and return a corrected JSON object. Remember:
- Only use component ids from the candidates list provided earlier.
- Follow the exact schema (required: schemaVersion, primary, secondary, contracts_crossed, confidence, unresolved, rationale).
- Rationale must be at most 600 characters.
- Return ONLY the JSON object.`;

/* ─── Input Assembler ─────────────────────────────────────────────────── */

/**
 * Build the scoping input from task text and resolve results.
 * The input contains ONLY task, candidates, flows, and domains — never the full catalog.
 *
 * @param taskText - The task description text
 * @param resolveResults - Candidate components from the resolve step
 * @param index - The catalog index (used to look up component details, flows, domains)
 * @returns The constrained scoping input
 */
export function buildScopingInput(
  taskText: string,
  resolveResults: ResolveCandidate[],
  index: CatalogIndex,
): ScopingInput {
  // Build candidate list from resolve results
  const candidateIds = new Set(resolveResults.map((r) => r.id));
  const candidates: ScopingCandidate[] = [];

  for (const result of resolveResults) {
    const comp = index.components.find((c) => c.id === result.id);
    if (!comp) continue;

    candidates.push(componentToCandidate(comp));
  }

  // Filter flows to only those with participants in the candidate set
  const flows: ScopingFlow[] = index.flows
    .filter((f) => f.participants.some((p) => candidateIds.has(p)))
    .map((f) => flowToScopingFlow(f));

  // Filter domains to only those containing candidate components
  const domains: ScopingDomain[] = index.domains
    .filter((d) => d.components.some((c) => candidateIds.has(c)))
    .map((d) => domainToScopingDomain(d, candidateIds));

  return {
    task: taskText,
    candidates,
    flows,
    domains,
  };
}

/**
 * Serialize the scoping input to a string for the LLM user message.
 */
export function serializeScopingInput(input: ScopingInput): string {
  return JSON.stringify(input, null, 2);
}

/* ─── Internal Helpers ────────────────────────────────────────────────── */

function componentToCandidate(comp: ComponentSummary): ScopingCandidate {
  return {
    id: comp.id,
    name: comp.name,
    description: comp.description,
    domain: comp.domain,
    provides: comp.provides.map((p) => p.id),
    consumes: comp.consumes.map((c) => c.contract),
  };
}

function flowToScopingFlow(flow: FlowEntry): ScopingFlow {
  return {
    id: flow.id,
    name: flow.name,
    participants: flow.participants,
  };
}

function domainToScopingDomain(domain: DomainEntry, candidateIds: Set<string>): ScopingDomain {
  return {
    name: domain.name,
    // Only include components that are in the candidate set
    components: domain.components.filter((c) => candidateIds.has(c)),
  };
}
