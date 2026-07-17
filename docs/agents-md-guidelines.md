# AGENTS.md Sizing and Content Guidelines

## Purpose

`AGENTS.md` is the root-level project description file that all AI coding agents read on every turn. Its content directly impacts token usage — every word costs tokens on every interaction. Keep it lean and operational.

## Recommended Size

- **Target:** ~1,000 words (~1,350 tokens)
- **Maximum:** ~1,500 words (~2,000 tokens)
- **Minimum:** ~400 words (~550 tokens) for a simple project

## What Belongs in AGENTS.md

Content that agents need **every turn** to make correct decisions:

- Project identity and core purpose (1-2 sentences)
- Design contract reference (`/DESIGN.md`)
- Taxonomy (agent vs skill vs instruction) — brief definitions
- Agent roster table (name, file, one-line purpose)
- Skills roster table (name, directory, one-line purpose)
- Instructions table (name, scope, purpose)
- General agent guidelines (branch discipline, commit conventions, quality gates, merge authority)

## What Does NOT Belong in AGENTS.md

Content that is reference material, not operational per-turn guidance:

- Workflow chain diagrams → move to `docs/workflow-chains.md`
- Prompt/command tables → agents carry their own invocation modes
- Detailed tool configuration → belongs in agent or skill files
- Post-mortems and decision logs → belongs in `docs/adr/` or memo-cli
- Setup instructions → belongs in README or `docs/`
- Verbose explanations of concepts → belongs in `docs/`

## Decision Rule

Before adding content to AGENTS.md, ask:

> "Does an agent need this information on **every single turn** to behave correctly?"

- **Yes** → put it in AGENTS.md
- **No, but agents need it sometimes** → put it in a skill file or docs/
- **No, it's for humans** → put it in README, docs/, or a wiki

## Generating a Right-Sized AGENTS.md

Run `product-engineer init` to generate foundation documents including a properly-sized AGENTS.md for your project. The init activity will:

1. Analyze your project structure
2. Identify which agents and skills are relevant
3. Produce an AGENTS.md that follows these sizing guidelines

## Measuring Token Impact

To check your AGENTS.md token cost:

```bash
# Approximate token count (words * 1.35)
wc -w AGENTS.md
```

If your AGENTS.md exceeds 1,500 words, audit it against the "What Does NOT Belong" list above and extract reference content to `docs/`.
