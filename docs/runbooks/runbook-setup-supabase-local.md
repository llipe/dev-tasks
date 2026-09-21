---
name: runbook-setup-supabase-local
trigger: A developer needs a local Supabase stack to run migrations, integration tests, or RLS checks without touching a shared project.
owner: infra-engineer
last_verified: 2026-09-19
related: []
---

# Set up a local Supabase stack

Local Supabase is where schema work happens. A migration is written and
proven locally, then pushed to a shared project through the confirmed flow.
The rule that makes this worth doing: `supabase db reset` is free locally and
forbidden against a shared project.

## Preconditions

- Docker is running. The local stack is containers; nothing starts without it.
- Supabase CLI v2 installed. dev-tasks never auto-installs it:

  ```bash
  supabase --version
  ```

- For linking to a remote project: `supabase login`, or
  `SUPABASE_ACCESS_TOKEN` exported, plus the project ref.

## Steps

1. Initialize the project, if `supabase/` does not exist yet:

   ```bash
   supabase init
   ```

2. Start the stack:

   ```bash
   supabase start
   ```

   It prints the API URL, DB URL, and anon/service keys. These are local
   development values — they are not secrets, and they are not the remote
   project's keys.

3. Link to the remote project only if you need to diff against it:

   ```bash
   supabase link --project-ref <ref>
   ```

4. Apply the existing migrations to your fresh local database:

   ```bash
   supabase db reset
   ```

   This drops and rebuilds the local database from `supabase/migrations/`. It
   is destructive, and locally that is exactly what you want — it proves the
   migrations reproduce the schema from nothing.

5. Author a new migration by diffing your local changes:

   ```bash
   supabase db diff -f add_orders_table
   ```

   The generated SQL is the plan. Review it before it goes anywhere, and
   itemize destructive statements (`DROP`, `TRUNCATE`, `ALTER ... DROP
COLUMN`, type narrowing) separately — each needs named approval before it
   reaches a shared project.

## Verification

```bash
supabase status
supabase migration list
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -c '\dt'
```

The stack reports running services, the migration list shows your migrations,
and the table list matches what you expect after a reset.

## Rollback

```bash
supabase stop            # stop the stack, keep the data volume
supabase stop --no-backup   # stop and discard local data
supabase db reset        # rebuild the local database from migrations
```

All three are local-only. None of them touch a remote project.

The rule that does not bend: a non-empty `supabase db diff` against a remote
with no pending local migration is drift. Report it and stop. Never push to
reconcile drift, and never `db reset` a shared project — reversing an applied
remote migration is a forward migration that reverses it.

## Escalation

A stack that will not start is almost always Docker (not running, or a port
already bound) — check `supabase status` and the container logs before
anything else. For drift against a shared project, escalate to whoever owns
that project with the `db diff` output; do not resolve it yourself.
