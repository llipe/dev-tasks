---
version: 1.0
name: Ubiquitous Language
description: Canonical domain vocabulary, organized by bounded context. Append-only; terms are superseded, never deleted.
status: unfilled
owner: product-engineer
---

# Ubiquitous Language

The canonical vocabulary of this repository. One term means one thing here, and
the name used in conversation is the name used in the code.

`status: unfilled` means no vocabulary has been established yet — never
permission to invent one. Terms arrive when a PRD or specification proposes them
and the user approves it; `product-engineer` appends them, one entry per term,
grouped under the bounded context they belong to. A term is never deleted: when
it is replaced, its `Status` records what superseded it, so a reader who meets
the old word in an old document can still find out what it meant.

Each term carries five fields — `Definition`, `Forbidden synonyms`, `Invariants`,
`Origin`, and `Status` — and every one of them is present, `none` included.
Bounded-context names resolve against the package map in `docs/tech.md`.

## Changelog

| Version | Date | Summary | Author |
| ------- | ---- | ------- | ------ |
