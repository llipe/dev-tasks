# Product Context: dev-tasks

## Changelog

| Version | Date       | Summary                                      | Author           |
| ------- | ---------- | -------------------------------------------- | ---------------- |
| 1.0     | 2026-07-20 | Initial repository-wide product constitution | product-engineer |

## Executive Summary

`dev-tasks` is a portable workflow harness for structured, AI-assisted software development. It distributes repository-local agents, skills, instructions, scripts, templates, and validation contracts that guide work from product refinement through implementation, verification, documentation, and human-reviewed delivery across supported AI coding platforms.

The product is not a hosted development service and does not replace a project's application stack, test framework, CI provider, or engineering judgment. It supplies a consistent operating system for agents while allowing each consumer repository to select tools appropriate to its language, architecture, risk, and delivery environment.

## Problem Statement

AI coding agents can produce code quickly, but unstructured use creates recurring failures:

- Requirements are ambiguous or become disconnected from implementation.
- Tests prove that code executes without proving that required behavior is correct.
- Agents declare completion without sufficient runtime evidence.
- Tool availability and permissions vary across environments, producing silent validation gaps.
- Browser, database, migration, security, and documentation checks are applied inconsistently.
- Agent-specific configurations drift across platforms.
- Automation can overreach into production or other sensitive environments without appropriate approval.

`dev-tasks` addresses these problems by defining explicit roles, artifacts, handoffs, quality gates, evidence requirements, escalation paths, and human authority boundaries.

## Target Users and Market

### Primary users

- Software developers and engineering teams of any size using AI coding agents to plan, implement, test, and review software.
- Teams seeking repeatable PRD-driven workflows without adopting a hosted orchestration platform.
- Projects that need stronger traceability between requirements, tests, delivered behavior, and pull-request evidence.

### Secondary users

- Maintainers who author and distribute reusable agent workflows across repositories.
- Engineering leads and reviewers who need concise, trustworthy evidence before approving changes.
- Platform and quality engineers who standardize CI, validation, security, and release practices.

The workflow must scale down to small projects and direct production environments while preserving a path to stronger environment separation and governance as projects mature.

## Strategic Goals

1. **Intent-to-evidence traceability:** Keep product intent, acceptance criteria, implementation tasks, tests, runtime observations, and delivery evidence connected throughout the development lifecycle.
2. **Confident autonomous execution:** Allow agents to iterate independently within explicit scope, retry, permission, safety, and escalation boundaries.
3. **Portable workflow contracts:** Define capabilities and outcomes independently of any single agent platform, language, framework, MCP server, or test runner.
4. **Defense in depth:** Combine test-first development, deterministic automation, realistic runtime validation, test-quality assessment, independent fidelity auditing, documentation checks, and human review.
5. **Safe integration with real systems:** Make read-only inspection the default and require explicit approval for production writes, migrations, destructive actions, and security-sensitive changes.
6. **Cross-platform behavioral parity:** Preserve equivalent workflow outcomes across GitHub Copilot, Claude Code, Kiro, and future supported agent environments, even when their configuration models differ.

## Current State

`dev-tasks` is an actively evolving toolkit distributed as a versioned repository bundle. It currently provides product, development, planning, verification, documentation, housekeeping, GitHub operations, and UX roles; reusable activity skills; scoped instructions; installer/update scripts; and support for multiple AI coding platforms.

The workflow already includes PRD-driven planning, test-first guidance, canonical quality gates, a pre-implementation verifier design mode, and a post-implementation fidelity audit. Its next maturity step is to turn validation from a mostly terminal completion phase into a bounded, evidence-producing feedback loop throughout implementation.

## Vision and Roadmap

### Near term

- Establish the repository-wide product and technical constitution.
- Strengthen acceptance-criterion quality and test traceability.
- Add bounded web-runtime self-verification using deterministic E2E tests as the source of truth.
- Add Supabase Cloud-first validation with safe local and cloud execution modes.
- Add incremental mutation testing to evaluate test-suite effectiveness.
- Standardize validation evidence attached to CI runs and pull requests.
- Make blocking, retry, fallback, and drift-resolution behavior explicit.

### Medium term

- Generalize reference implementations into portable capability contracts.
- Add profiles for additional languages, databases, browser tools, and mutation frameworks.
- Measure workflow effectiveness using escaped-defect, validation-completeness, and false-confidence indicators.
- Improve cross-platform conformance testing for distributed agents and skills.

### Long term

Provide a dependable, extensible development harness in which AI agents can execute substantial engineering work autonomously while producing enough reproducible evidence for humans to make informed product, security, and merge decisions.

## Success Metrics

Repository-level directional metrics are:

- Every acceptance criterion maps to one or more validation methods and recorded outcomes.
- No required acceptance check is failing when a pull request becomes ready for review.
- No unresolved critical or major unintended drift remains at pull-request readiness.
- Mutation effectiveness does not regress from an established project baseline.
- Every unavailable validation capability has a documented fallback or an explicit incomplete-validation result.
- Supported agent platforms maintain equivalent behavioral contracts and required workflow gates.
- Production writes and migration applications have recorded human approval and post-operation verification.
- Consumer installation and update paths remain reproducible and do not overwrite consumer-owned configuration or secrets.

Consumer repositories set numeric coverage, mutation, performance, and reliability thresholds appropriate to their own risk profile. `dev-tasks` supplies defaults, baseline strategies, and escalation behavior rather than pretending one threshold fits every project.

## Competitive Landscape

Alternatives include ad hoc prompting, platform-specific agent files, coding-agent rule collections, generic task templates, and hosted development orchestration products. These approaches may provide useful instructions or automation but often lack one or more of:

- An end-to-end product-to-delivery chain.
- Cross-platform packaging.
- Explicit agent role boundaries.
- Test-first and independent verification stages.
- Requirement-to-evidence traceability.
- Safe production-operation gates.
- A consumer-owned, repository-local distribution model.

`dev-tasks` differentiates itself through portable structured workflows, GitHub-centered execution state, explicit human authority, evidence-driven completion, and extensible capabilities rather than dependence on one vendor or runtime.

## Key Constraints

- AI platforms expose different agent, tool, MCP, permission, hook, and delegation capabilities.
- Consumer repositories vary widely in language, architecture, package manager, CI, test maturity, and environment topology.
- Tools such as browser automation, mutation frameworks, database CLIs, and MCP servers may be unavailable or unconfigured.
- The harness must not silently install dependencies, configure credentials, or mutate consumer-owned files.
- Some small projects operate directly against production; the workflow must remain usable while applying stricter approval and safety controls.
- Deterministic validation should be preferred, but some runtime evidence remains observational or environment-dependent.
- Additional validation must provide confidence without making routine pull requests impractically slow or expensive.

## Key Stakeholders

- **Product owner and repository maintainer:** Defines product direction, approves architecture and scope changes, and owns release decisions.
- **Consumer developers and teams:** Adopt the harness, configure project-specific tools, and provide feedback on workflow usability and effectiveness.
- **Human reviewers:** Retain approval authority for pull requests targeting the default branch and for sensitive or production operations.
- **Agent-platform maintainers:** Indirect stakeholders whose platform capabilities constrain packaging and runtime behavior.

## Assumptions

- GitHub Issues and Pull Requests remain the primary execution and review records where GitHub is available.
- Consumer repositories own their application code, credentials, MCP configuration, environment topology, and numeric quality thresholds.
- Agents may detect and recommend tools, templates, or dependencies but require an approved task before changing project dependencies or configuration.
- Playwright-style committed E2E tests are the authoritative source for repeatable browser behavior; live browser tooling augments diagnosis and exploratory validation.
- Supabase Cloud is the primary initial backend profile, with local Supabase support retained as a deterministic alternative.
- JavaScript/TypeScript is the first mutation-testing reference ecosystem, while the capability contract remains implementation-neutral.
- Humans remain accountable for intentional requirement changes, production writes, sensitive security decisions, and merges to the default branch.

## Open Questions

- Which additional language and infrastructure profiles should follow the initial web, JavaScript/TypeScript, and Supabase profile?
- Which validation-effectiveness metrics best predict reduced escaped defects without creating counterproductive gate pressure?
- How should cross-platform conformance be automated as agent platforms evolve their tool and delegation models?
