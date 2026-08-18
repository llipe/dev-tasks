# Documentation Index

Entry point for `dev-tasks` documentation. Each document below is the single source of truth for its subject — content is not duplicated between them.

## Start Here

| If you want to…                                        | Read                                                   |
| ------------------------------------------------------ | ------------------------------------------------------ |
| Install and run the toolkit                            | [`../README.md`](../README.md)                         |
| Understand what the system is and how it fits together | [`system-overview.md`](system-overview.md)             |
| Look up a `dev-tasks` command                          | [`dev-tasks-user-manual.md`](dev-tasks-user-manual.md) |
| Look up a `dt` command                                 | [`dt-user-manual.md`](dt-user-manual.md)               |
| Know which agent to invoke, in what order              | [`workflow-chains.md`](workflow-chains.md)             |

## Reference

| Document                                             | Subject                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`system-overview.md`](system-overview.md)           | Purpose, architecture, components, integrations, runtime flows, NFR posture  |
| [`data-model.md`](data-model.md)                     | Artifacts and entities, invariants, ownership boundaries, exit-code contract |
| [`artifact-formats.md`](artifact-formats.md)         | Serialization format and authorship per artifact, with exceptions            |
| [`product-context.md`](product-context.md)           | Product constitution: problem, users, goals, metrics, constraints            |
| [`technical-guidelines.md`](technical-guidelines.md) | Enforceable engineering rules and quality gates                              |
| [`agents-md-guidelines.md`](agents-md-guidelines.md) | Sizing and content rules for `AGENTS.md`                                     |
| [`adr/`](adr/README.md)                              | Architecture decision records                                                |
| [`requirements/`](requirements/)                     | Product requirements documents                                               |

## Registries and Contracts

These live outside `docs/` because agent runtimes load them directly:

| File              | Subject                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `../AGENTS.md`    | Authoritative registry of agents, skills, and instructions; agent rules |
| `../CLAUDE.md`    | Claude Code entry point                                                 |
| `../DESIGN.md`    | Canonical design-system contract for UI work                            |
| `../TESTING.md`   | Canonical testing contract — layers, runners, thresholds, fixtures      |
| `../CHANGELOG.md` | Release history                                                         |

## Working Documents

`../workstream/` holds active execution artifacts — specifications, user stories, task lists, planner state, and fidelity reports. Completed artifacts move to `../workstream/archive/`. These are working records, not current-state documentation: when they disagree with the documents above, the documents above win.
