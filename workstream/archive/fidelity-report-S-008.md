# Fidelity Report — Story S-008

## Header/Verdict

| Field | Value |
|-------|-------|
| **Fidelity** | High |
| **Highest Drift Impact** | None |
| **Scope** | Story S-008 / Issue #41 / PR #72 |
| **Branch** | `story/S-008-extract-asyncapi` (base: `integration/mrc-phase1-extraction`) |
| **Audit Date** | 2025-01-27 |

---

## Human-Readable Summary

The implementation of `dt extract asyncapi` delivers exactly what was requested. The tool scans a TypeScript codebase for kafkajs usage, identifies which topics are produced and consumed, classifies the confidence level of both topic names and message payloads, and outputs an AsyncAPI 2.6 document that passes structural validation.

All five acceptance criteria are fully met. The topic extraction correctly recognizes `producer.send`, `producer.sendBatch`, and `consumer.subscribe` (including the array-of-topics variant). Confidence levels are assigned correctly: string literals and module constants get "high", template literals with env vars get "medium" (with pattern/variable metadata), and unresolvable expressions get "low" plus an entry in the unresolved list. Payloads are classified as typed/inline/opaque with appropriate confidence. The two confidence dimensions — `topic_confidence` and `payload_confidence` — are tracked independently on every operation. Output validates against AsyncAPI structural constraints.

No drift was detected between the spec, the task list, the implementation, and the test suite.

---

## Per-AC Result Table

| AC-ID | Description | Codebase Evidence | Workstream Evidence | Test Evidence | Result |
|-------|-------------|-------------------|---------------------|---------------|--------|
| AC-1 | AST over kafkajs producer.send/sendBatch yields provides; consumer.subscribe yields consumes | `topics.ts` handles `send` (L96-109), `sendBatch` (L114-136), `subscribe` with `topic` and `topics` array (L141-173) | Tasks 8.1.1–8.1.4 marked [x] | Unit: "extracts string literal topic from producer.send", "extracts topic from producer.sendBatch → provides", "extracts single topic from subscribe", "extracts multiple topics from subscribe({ topics })" — all pass | **Pass** |
| AC-2 | Topic resolution confidence: literal/constant → high; template → medium (records pattern + variable); unresolvable → low + unresolved[] | `topics.ts` `resolveTopicExpression()` (L183-232): string literal → high, template → medium w/ pattern+variables, identifier resolved → high (constant), fallback → low + unresolved entry | Tasks 8.2.1–8.2.4 marked [x] | Unit: "resolves module constant → high confidence", "resolves enum member → high confidence", "resolves template literal with env var → medium confidence" (asserts pattern/variables), "marks unresolvable → low + unresolved[]" — all pass. Integration: kafkajs-config-env fixture validates constant, enum, template resolutions | **Pass** |
| AC-3 | Payload confidence: typed send → medium from type; inline object literal → low (LLM infers shape); opaque serialization → low + unresolved[] | `payloads.ts` `classifyPayload()`: typed variable w/ interface → medium + schema derived (L155-163); inline object literal → low + inferred schema (L138-146); Buffer/JSON.stringify(untyped) → opaque low + unresolved (L113-134) | Tasks 8.3.1–8.3.3 marked [x] | Unit: "classifies typed producer.send" (medium), "classifies inline object" (low), "classifies Buffer as opaque" (low + unresolved), "classifies JSON.stringify(any) as opaque" (low + unresolved) — all pass. Integration: kafkajs-typed-payloads, kafkajs-opaque-payloads fixtures confirm | **Pass** |
| AC-4 | topic_confidence and payload_confidence tracked and emitted separately on each contract | `types.ts` `AsyncApiOperation` interface has both fields independently (L88-91). `extract-asyncapi.ts` `buildChannels()` populates them from separate sources. `validate.ts` emits them as `x-topic-confidence` and `x-payload-confidence` in the AsyncAPI doc | Task 8.4 marked [x] | Integration: "has separate topic_confidence and payload_confidence per channel" test explicitly asserts both fields exist and are independent strings | **Pass** |
| AC-5 | Output validates against the AsyncAPI schema | `validate.ts` implements structural validation for AsyncAPI 2.x/3.x (required fields, channel structure). `extract-asyncapi.ts` calls `validateAsyncApi()` on every extraction result | Task 8.5 marked [x] | Unit: 7 validation tests (valid 2.6, valid 3.0, missing fields, invalid version). Integration: all 4 fixture suites include "produces a valid AsyncAPI document" assertion — all pass | **Pass** |

---

## Drift Catalog

No drift items detected.

---

## Edge-Case and Test Outcomes

| Category | Test | Result |
|----------|------|--------|
| subscribe with topics array (mixed) | `handles subscribe({ topics: [...] }) with mixed resolution` | Pass |
| Topic from config array (unresolvable) | `handles topic from config array with unresolvable entries` | Pass |
| Buffer payload | `classifies Buffer type annotation as opaque with unresolved` | Pass |
| Producer with no consumers | `extracts producer topics even without matching consumers` | Pass |
| Multiple operations on same topic | `produces separate entries for producer and consumer on same topic` | Pass |
| No kafkajs usage | `returns empty when no kafkajs patterns found` | Pass |

---

## Recommendations

No action needed. All acceptance criteria pass with full test coverage and no drift.

---

## Output Contract

| Field | Value |
|-------|-------|
| Mode | Audit |
| Phase | 4 — Reporting & Publication |
| Source artifact | Issue #41 (AC 1-5) + `workstream/tasks-multi-repo-context-plan.md` (tasks 8.0-8.16) |
| Output file | `/workstream/fidelity-report-S-008.md` |
| GitHub issue | #41 |
| AC coverage | 5/5 covered, 5/5 pass |
| Overall fidelity | High |
| Highest drift impact | None |
| Blocking gaps | None |
