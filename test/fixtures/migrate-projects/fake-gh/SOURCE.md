# Fixture: fake `gh`

Hand-written. `gh` is a Node script the Layer 2 CLI tests place, alone with
a `node` symlink, in a purpose-built `PATH` directory (TESTING.md
PATH-fragility note; test plan A-85), so the real `execFile("gh")` runner
is exercised without a real `gh` or the network.

It replays the responses in `$FAKE_GH_SCENARIO` per argv and appends every
argv to `$FAKE_GH_LOG`. The test builds the scenario from the in-memory
fixture model (`test/unit/migrate-projects/helpers/fake-github.ts`).
