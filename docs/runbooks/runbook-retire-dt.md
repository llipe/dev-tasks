---
name: runbook-retire-dt
trigger: A consumer repository still carries the retired `dt` multi-repo context layer and is upgrading past the release that removed it.
owner: developer
last_verified: 2026-09-19
related: ["docs/adr/ADR-007-retire-multi-repo-context-layer.md"]
---

# Retire the `dt` multi-repo context layer

`dev-tasks` once shipped a second binary, `dt`, covering extraction, catalog
aggregation, context assembly, and cross-service contract verification. It
was removed in full — see ADR-007. This procedure is for a repository that
still has its traces.

If you never ran `dt`, you have nothing to do: the binary and its prompt-tree
content leave a consumer repository through the normal `update`.

## Preconditions

- You know whether anything in your repository actually invoked `dt` — CI
  jobs, scripts, or prompts. Grep before assuming:

  ```bash
  grep -rn '\bdt \|dt-catalog\|meta-repo' --include='*.yml' --include='*.sh' --include='*.md' . \
    | grep -v node_modules
  ```

- You have read ADR-007. It lists exactly what was removed and why, and names
  the restore point.

## Steps

1. Update to a release that no longer ships the layer:

   ```bash
   pnpm update @llipe.com/dev-tasks
   pnpm exec dev-tasks update
   ```

2. Remove your own references. dev-tasks removes what it delivered; it does
   not edit files you own. That means your CI jobs, wrapper scripts, and any
   custom prompts naming `dt` are yours to delete.

3. Delete any `dt`-era artifacts you generated: catalog files, assembled
   context bundles, and meta-repo scaffolding. They have no reader now.

4. If a `dt` capability turns out to be load-bearing for you, do not
   reconstruct it by hand. Start from tag `v0.13.0` (commit `0a6f35e`), the
   last release that shipped the full layer, and re-run the PRD cycle against
   the current codebase. The layer's modules were mutually dependent, so
   cherry-picking individual files does not produce a working system.

## Verification

```bash
pnpm exec dev-tasks --help
grep -rn '\bdt \|meta-repo' --include='*.yml' --include='*.sh' . | grep -v node_modules
which dt || echo "dt not on PATH — expected"
```

The help output lists only `install`, `update`, `status`, `pin`, `unpin`,
`doctor`, and `migrate`. The grep returns nothing from your own files. No
`dt` binary resolves.

## Rollback

Pin back to the last release that shipped the layer:

```bash
pnpm exec dev-tasks pin 0.13.0
pnpm exec dev-tasks update
```

This is a holding action, not a fix. Pinning to `0.13.0` also forgoes every
later change, so treat it as a window in which to remove your dependency on
`dt` rather than a resting state.

## Escalation

If you depended on a `dt` capability with no replacement, open an issue at
https://github.com/llipe/dev-tasks describing the workflow rather than the
command — the layer was retired for lack of an adopted consumer, and a
concrete workflow is the evidence that changes that conclusion.
