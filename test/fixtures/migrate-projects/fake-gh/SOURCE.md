# Fixture: fake `gh`

Hand-written. `gh` is a Node script the Layer 2 CLI tests place, alone with
a `node` symlink, in a purpose-built `PATH` directory (TESTING.md
PATH-fragility note; test plan A-85), so the real `execFile("gh")` runner
is exercised without a real `gh` or the network.

It replays the responses in `$FAKE_GH_SCENARIO` per argv and appends every
argv to `$FAKE_GH_LOG`. The test builds the scenario from the in-memory
fixture model (`test/unit/migrate-projects/helpers/fake-github.ts`).

For `--apply` (S-015) a body-file path in an argv is keyed as `<file>`,
because each run writes its bodies under fresh temp names; the test builds
those scenarios by running `--apply` in process over a copy of the model
with the write half of the fake (`helpers/fake-github-writes.ts`), then
replays its answers. `$FAKE_GH_BODIES` records each body as `gh` would read
it, and `$FAKE_GH_DELAY_MS` (or a response's `delayMs`) slows every answer
so a test can interrupt a run between calls.
