# Fidelity Report — S-007: dt extract openapi (routes 1 and 3)

## Header / Verdict

| Field | Value |
|-------|-------|
| **Fidelity** | High |
| **Highest Drift Impact** | None |
| **Issue** | #39 |
| **PR** | #71 |
| **Branch** | `story/S-007-extract-openapi` |

## Human-Readable Summary

The implementation delivers all seven acceptance criteria for S-007. Route 1 copies an on-disk OpenAPI spec, normalizes it to version 3.1.0, resolves internal `$ref` pointers, and labels it `introspected / high`. Route 3 performs AST-based route discovery for Express, Fastify, Hono, and NestJS, deriving typed parameters (including zod schemas), marking untyped responses as schema-less, and reporting dynamic routes in an `unresolved[]` array rather than omitting them. The LLM descriptions module writes only `summary`, `description`, and `tags` on each endpoint, never modifying structural fields. All extraction output validates against an OpenAPI 3.1 structural validator. The `--strategy` CLI flag selects the route, and confidence is recorded in the output. Route 2 is defined as an interface-only hook with a clear "not yet implemented" error.

Quality gates are green: 337 tests passing, typecheck clean, format clean, lint clean.

## Per-AC Result Table

| AC-ID | Description | Codebase Evidence | Test Evidence | Result |
|-------|-------------|-------------------|---------------|--------|
| AC-1 | Route 1 copies + normalizes on-disk spec + attaches introspected/high | `route1.ts`: `detectOnDiskSpec` finds yaml/json candidates, `parseOpenApiFile` reads content, `normalizeSpec` upgrades to 3.1.x + resolves `$ref`, returns `{ source: "introspected", confidence: "high", strategy: "route1" }` | `extract-openapi-route1.test.ts` asserts `source=introspected`, `confidence=high`, version upgrade; integration test validates full flow | **Pass** |
| AC-2 | Route 3 AST discovery + typed params + zod support + marks unknown responses schema-less | `route3.ts`: `extractRoute3` walks TS AST for Express/Fastify/Hono/NestJS patterns, `analyzeHandler` extracts typed params from `Request<>` generics, `findZodSchema`/`extractZodObject` handle zod, `analyzeReturnType` returns `null` schema for `any`/`unknown`, `defaultResponse()` uses `schema: null` | `extract-openapi-route3.test.ts` covers all frameworks; `extract-openapi-edge-cases.test.ts` confirms `typed: false` + `confidence: low` for untyped; integration tests validate zod fixture | **Pass** |
| AC-3 | LLM writes only summary/description/tags — nothing structural | `llm-descriptions.ts`: `applyLlmDescriptions` spreads existing endpoint with only `summary`, `description`, `tags` from LLM output; `OpenApiLlmProvider` interface constrains contract; no path/method/param/schema fields are touched | Type system enforces: `EndpointDescriptionOutput` has only `summary/description/tags`; spread preserves all structural fields | **Pass** |
| AC-4 | Output validates against OpenAPI 3.1 | `validate.ts`: `validateOpenApi` checks required fields (`openapi: 3.1.x`, `info`, `paths`), validates path/method structure, checks `responses` required per operation; `extractionResultToDocument` converts result to standard document | `extract-openapi-validate.test.ts` (9 tests) covers valid/invalid docs; all integration tests validate output | **Pass** |
| AC-5 | Dynamic routes -> unresolved[], not omitted | `route3.ts` `resolvePathArgument`: non-string-literal path args push to `unresolved[]` with `file/line/reason/snippet`; no endpoint is created for dynamic paths | `dynamic-routes` fixture has loop/env/spread patterns; unit+integration tests confirm `unresolved.length > 0` and `/health` static route still present | **Pass** |
| AC-6 | --strategy selects route; confidence recorded | `parse-args.ts` parses `--strategy`; `extract-openapi.ts` `runExtractOpenApi` uses strategy to branch (`"1"`/`"3"`/`"auto"`); output includes `strategy_used` and `confidence` | `bin/dt.ts` wires `--strategy` from args; human output prints "Strategy" and "Confidence" lines; JSON output includes `strategy_used` field | **Pass** |
| AC-7 | Route 2 hook interface defined (not implemented) | `route2.ts` exports `Route2Config`, `Route2Extractor` interfaces and `extractRoute2` that returns `Promise.reject(new Error("Route 2 ... is not yet implemented."))` | Barrel export in `index.ts` re-exports types; no caller invokes route 2 except in error-path messaging | **Pass** |

## Drift Catalog

No drift detected. All acceptance criteria are fully met with matching implementation and test coverage.

## Recommendations

No action needed. The implementation is complete and faithful to the spec/story intent.
