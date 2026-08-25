## verifier — SC-20 baseline captured (pre-implementation)

Recording this before implementation starts, because after the first edit to `developer` there is no baseline left to compare against.

Rule 19 (`Test-first design`) is currently **byte-identical across all four `developer` variants**, which is itself the AC-7 precondition:

| File                                | Rule 19 line | `sha256`                                                           |
| ----------------------------------- | ------------ | ------------------------------------------------------------------ |
| `.kiro/agents/developer.md`         | 104          | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.github/agents/developer.agent.md` | 85           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.claude/agents/developer.md`       | 86           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.claude/commands/developer.md`     | 89           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |

**SC-20 passes only if all four still hash to this value after implementation.** Reproduce with:

```bash
grep -A0 '^19\. \*\*Test-first design' <file> | shasum -a 256
```

Task-list sub-task 1.1 no longer needs to produce this baseline — it is recorded here and in `workstream/test-plan-123.md`.
