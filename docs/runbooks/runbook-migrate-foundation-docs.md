---
name: runbook-migrate-foundation-docs
trigger: A repository installed before the foundation-document rename still carries docs/product-context.md or docs/technical-guidelines.md, or `dev-tasks doctor` reports the `foundation-doc-names` check failing.
owner: developer
last_verified: 2026-09-19
related: []
---

# Migrate the foundation documents to their current names

`docs/product-context.md` became `docs/product.md` and
`docs/technical-guidelines.md` became `docs/tech.md`. This procedure applies
that rename to a consumer repository.

Nothing is broken if you do not run it. Agents resolve the new name first and
fall back to the old one. `doctor` reports the old names as a warning — it is
telling you the migration is available, not that anything failed, and it does
not change `doctor`'s exit code.

## Preconditions

- A clean working tree. The rename touches tracked files; review it as its
  own commit.
- dev-tasks >= the release that shipped `migrate docs`. Check with
  `dev-tasks --version`; if the sub-verb is missing, `dev-tasks migrate docs`
  falls through to the legacy shell-install migration instead.
- Know which of your own files reference the old names. The propose step
  lists them for you.

## Steps

1. See what would change. This mutates nothing:

   ```bash
   pnpm exec dev-tasks migrate docs
   ```

2. Read the two lists it prints: the renames it will perform, and the files of
   yours that still name the old documents.

3. Apply the rename:

   ```bash
   pnpm exec dev-tasks migrate docs --force
   ```

   Originals are copied to `.dev-tasks/backup/<timestamp>/` first.

4. Update your own references by hand — prompts, CI config, READMEs. The
   command does not edit files you own, and neither does `dev-tasks update`.

5. Commit the rename separately from any content change to either document,
   so the diff reads as a rename rather than a rewrite.

## Verification

```bash
ls docs/product.md docs/tech.md
pnpm exec dev-tasks doctor --json | grep foundation-doc-names
git status --short
```

Both files exist, the `foundation-doc-names` check passes, and `git status`
shows renames with no content delta.

If the command exited `14`, one rename was skipped because its target already
existed — you had half-migrated by hand. Reconcile the two files yourself and
re-run; the command will not choose between them for you.

## Rollback

```bash
cp .dev-tasks/backup/<timestamp>/docs/*.md docs/
```

Then delete the new-named copies. The backup holds the originals byte for
byte. Because the rename is content-preserving, `git checkout -- docs/` on an
uncommitted rename is equally sufficient.

## Escalation

If the command reports an error rather than a skip, the rename failed at the
filesystem level — check directory permissions and disk space, and attach the
`--json` output to an issue at https://github.com/llipe/dev-tasks.
