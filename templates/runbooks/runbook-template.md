---
name: runbook-<slug>
trigger: <the observable condition that makes someone open this file>
owner: <team or role accountable for keeping it true>
last_verified: <YYYY-MM-DD — the date someone last ran it end to end>
related: ["<path/to/script.sh>", "<path/to/workflow.yml>"]
---

# <Procedure name>

One or two sentences: what this procedure accomplishes, and when it is the
wrong tool. State the blast radius here if there is one.

## Preconditions

- Access, credentials, or approvals required before starting.
- State the system must already be in.
- Anything that makes this procedure unsafe right now.

## Steps

1. One command or action per step, in the order they run.
2. Paste the command verbatim. A step the reader has to reconstruct is a
   step they will get wrong at 2am.
3. Note which steps are reversible and which are not.

## Verification

How you know it worked — a command whose output you can check, not "confirm
it looks right". State the expected output.

## Rollback

How to undo it, or an explicit statement that it cannot be undone and what
that means. "No rollback" is a valid answer; silence is not.

## Escalation

Who to contact when the procedure fails, and what to tell them. Include the
evidence worth collecting before escalating.
