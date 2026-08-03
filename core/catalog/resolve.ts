/**
 * Lexical weighted scorer for text → component resolution.
 * Deterministic and explainable — no embeddings in v1.
 *
 * Spec: PRD RF-24, RF-28; Issue #46 AC1.
 */

import type { CatalogIndex, ComponentSummary, FlowEntry } from "./index-model.js";

/* ─── Text Normalization ───────────────────────────────────────────── */

/**
 * Spanish/English stopwords to remove from query and field text.
 */
const STOPWORDS = new Set([
  // English
  "a",
  "an",
  "the",
  "is",
  "it",
  "of",
  "in",
  "to",
  "and",
  "or",
  "for",
  "on",
  "at",
  "by",
  "with",
  "from",
  "this",
  "that",
  "be",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "do",
  "does",
  "did",
  "not",
  "but",
  "if",
  "as",
  "its",
  "my",
  "our",
  "your",
  // Spanish
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "en",
  "con",
  "por",
  "para",
  "es",
  "son",
  "y",
  "o",
  "que",
  "se",
  "su",
  "al",
  "como",
  "no",
  "más",
  "mas",
  "pero",
  "sus",
]);

/**
 * Light suffix-removal stemmer for English and Spanish.
 * Removes common suffixes to match word stems.
 * Not a full Porter/Snowball stemmer — just enough for routing.
 * Conservative: requires minimum remaining stem length of 3.
 */
function lightStem(word: string): string {
  if (word.length <= 4) return word;

  // English suffixes (ordered longest first, with min stem length guards)
  if (word.length > 9 && word.endsWith("ations")) return word.slice(0, -6);
  if (word.length > 8 && word.endsWith("ation")) return word.slice(0, -5);
  if (word.length > 8 && word.endsWith("ments")) return word.slice(0, -5);
  if (word.length > 8 && word.endsWith("ience")) return word.slice(0, -5);
  if (word.length > 7 && word.endsWith("ment")) return word.slice(0, -4);
  if (word.length > 7 && word.endsWith("ness")) return word.slice(0, -4);
  if (word.length > 7 && word.endsWith("ings")) return word.slice(0, -4);
  if (word.length > 7 && word.endsWith("tion")) return word.slice(0, -4);
  if (word.length > 7 && word.endsWith("sion")) return word.slice(0, -4);
  if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 6 && word.endsWith("ers")) return word.slice(0, -3);
  if (word.length > 6 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 6 && word.endsWith("ous")) return word.slice(0, -3);
  if (word.length > 5 && word.endsWith("ed") && !word.endsWith("eed")) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("er")) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("ly")) return word.slice(0, -2);
  if (word.length > 5 && word.endsWith("es") && !word.endsWith("ies")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && word.length > 4)
    return word.slice(0, -1);

  // Spanish suffixes
  if (word.length > 7 && word.endsWith("ción")) return word.slice(0, -4);
  if (word.length > 8 && word.endsWith("iones")) return word.slice(0, -5);
  if (word.length > 8 && word.endsWith("mente")) return word.slice(0, -5);
  if (word.length > 6 && word.endsWith("ado")) return word.slice(0, -3);
  if (word.length > 6 && word.endsWith("ido")) return word.slice(0, -3);
  if (word.length > 7 && word.endsWith("ando")) return word.slice(0, -4);
  if (word.length > 8 && word.endsWith("iendo")) return word.slice(0, -5);

  return word;
}

/**
 * Normalize text for matching:
 * 1. Lowercase
 * 2. NFD decompose and strip combining marks (de-accent)
 * 3. Split on non-alphanumeric (including hyphens/underscores)
 * 4. Remove stopwords
 * 5. Light stemming
 *
 * Returns array of normalized tokens.
 */
export function normalizeText(text: string): string[] {
  // Lowercase and de-accent via NFD decomposition + strip combining marks
  const deaccented = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Split on non-alphanumeric boundaries
  const tokens = deaccented.split(/[^a-z0-9]+/).filter((t) => t.length > 0);

  // Remove stopwords and stem
  return tokens.filter((t) => !STOPWORDS.has(t)).map((t) => lightStem(t));
}

/**
 * Normalize a single term for exact matching (no stemming, just lowercase + de-accent).
 */
export function normalizeId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ─── Scoring Signals ──────────────────────────────────────────────── */

/**
 * Signal weights per the Issue #46 AC:
 * exact id: 100, alias: 80, flow alias: 75, domain: 60,
 * alias-token: 40, glossary→domain: 35, name/description: 25
 */
const WEIGHT = {
  EXACT_ID: 100,
  ALIAS_EXACT: 80,
  FLOW_ALIAS: 75,
  DOMAIN: 60,
  ALIAS_TOKEN: 40,
  GLOSSARY_DOMAIN: 35,
  PROVIDES_ID: 80,
  NAME_DESCRIPTION: 25,
} as const;

export type SignalType =
  | "exact_id"
  | "alias_exact"
  | "flow_alias"
  | "domain"
  | "alias_token"
  | "glossary_domain"
  | "provides_id"
  | "name_description";

export interface MatchedSignal {
  type: SignalType;
  weight: number;
  matched: string;
}

export interface ResolveCandidate {
  id: string;
  score: number;
  signals: MatchedSignal[];
}

export interface ResolveOptions {
  /** Minimum score threshold (default: 20) */
  threshold?: number;
  /** Maximum results returned (default: 12) */
  limit?: number;
}

/* ─── Scorer ───────────────────────────────────────────────────────── */

/**
 * Score a component against normalized query tokens and raw query.
 */
function scoreComponent(
  component: ComponentSummary,
  queryTokens: string[],
  rawQueryNorm: string,
  flowAliases: Map<string, string[]>,
): { score: number; signals: MatchedSignal[] } {
  const signals: MatchedSignal[] = [];
  let score = 0;

  // 1. Exact ID match
  if (normalizeId(component.id) === rawQueryNorm) {
    score += WEIGHT.EXACT_ID;
    signals.push({ type: "exact_id", weight: WEIGHT.EXACT_ID, matched: component.id });
  }

  // 2. Alias exact match
  for (const alias of component.aliases) {
    if (normalizeId(alias) === rawQueryNorm) {
      score += WEIGHT.ALIAS_EXACT;
      signals.push({ type: "alias_exact", weight: WEIGHT.ALIAS_EXACT, matched: alias });
      break; // only count once
    }
  }

  // 3. Alias token match (substring/partial)
  if (!signals.some((s) => s.type === "alias_exact")) {
    for (const alias of component.aliases) {
      const aliasTokens = normalizeText(alias);
      const overlap = queryTokens.filter((qt) =>
        aliasTokens.some((at) => at.includes(qt) || qt.includes(at)),
      );
      if (overlap.length > 0) {
        score += WEIGHT.ALIAS_TOKEN;
        signals.push({
          type: "alias_token",
          weight: WEIGHT.ALIAS_TOKEN,
          matched: alias,
        });
        break; // only count once
      }
    }
  }

  // 4. Provides[].id match (treated like alias-exact weight)
  for (const p of component.provides) {
    if (normalizeId(p.id) === rawQueryNorm) {
      score += WEIGHT.PROVIDES_ID;
      signals.push({ type: "provides_id", weight: WEIGHT.PROVIDES_ID, matched: p.id });
      break;
    }
  }

  // 5. Flow alias match (component participates in a flow whose alias matches)
  const componentFlowAliases = flowAliases.get(component.id);
  if (componentFlowAliases) {
    for (const fAlias of componentFlowAliases) {
      if (
        normalizeId(fAlias) === rawQueryNorm ||
        queryTokens.some((qt) => normalizeId(fAlias).includes(qt))
      ) {
        score += WEIGHT.FLOW_ALIAS;
        signals.push({ type: "flow_alias", weight: WEIGHT.FLOW_ALIAS, matched: fAlias });
        break;
      }
    }
  }

  // 6. Domain match
  const domainTokens = normalizeText(component.domain);
  if (domainTokens.some((dt) => queryTokens.includes(dt))) {
    score += WEIGHT.DOMAIN;
    signals.push({ type: "domain", weight: WEIGHT.DOMAIN, matched: component.domain });
  }

  // 7. Name/description word match
  const nameDescTokens = normalizeText(`${component.name} ${component.description}`);
  const wordOverlap = queryTokens.filter((qt) => nameDescTokens.includes(qt));
  if (wordOverlap.length > 0) {
    // Proportional: more matched words = higher contribution, capped at weight
    const proportion = Math.min(wordOverlap.length / queryTokens.length, 1);
    const wordScore = Math.round(WEIGHT.NAME_DESCRIPTION * proportion);
    if (wordScore > 0) {
      score += wordScore;
      signals.push({
        type: "name_description",
        weight: wordScore,
        matched: wordOverlap.join(", "),
      });
    }
  }

  return { score, signals };
}

/**
 * Build a map of component id → flow aliases that route to it.
 * A flow's name, id, and aliases all count as flow aliases for its participants.
 */
function buildFlowAliasMap(flows: FlowEntry[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const flow of flows) {
    const flowIdentifiers = [flow.id, flow.name];
    if (flow.aliases) {
      flowIdentifiers.push(...flow.aliases);
    }

    for (const participant of flow.participants) {
      const existing = map.get(participant) ?? [];
      existing.push(...flowIdentifiers);
      map.set(participant, existing);
    }
  }

  return map;
}

/* ─── Public API ───────────────────────────────────────────────────── */

/**
 * Resolve free-text query against the catalog index.
 * Returns top candidates sorted by score descending, above threshold.
 *
 * Deterministic: same input always produces same output.
 */
export function catalogResolve(
  index: CatalogIndex,
  text: string,
  options: ResolveOptions = {},
): ResolveCandidate[] {
  const { threshold = 20, limit = 12 } = options;

  const queryTokens = normalizeText(text);
  const rawQueryNorm = normalizeId(text);

  if (queryTokens.length === 0 && rawQueryNorm.length === 0) {
    return [];
  }

  // Build flow alias map for scoring
  const flowAliases = buildFlowAliasMap(index.flows);

  // Score each component
  const candidates: ResolveCandidate[] = [];

  for (const component of index.components) {
    const { score, signals } = scoreComponent(component, queryTokens, rawQueryNorm, flowAliases);
    if (score >= threshold) {
      candidates.push({ id: component.id, score, signals });
    }
  }

  // Sort by score descending, then by id for stability
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });

  return candidates.slice(0, limit);
}
