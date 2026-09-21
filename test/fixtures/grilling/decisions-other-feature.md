# Decisions: other-feature (fixture)

Fixture prior decision log for scenario (d) (`issue-mode-reuse.md`) — a
made-up, unrelated feature (`other-feature`) that happens to have already
settled a question relevant to the fixture issue in
`issue-mode-reuse.md`. Not a real project artifact; used only so the
scenario can demonstrate keyword-gated cross-log reuse (FR-10) without
depending on a real feature's log.

## WHAT phase

| ID   | Phase | Branch                     | Question                                                    | Recommended                                        | Answer                                                              | Accepted rec. | Supersedes | Author | Date       |
| ---- | ----- | --------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- | -------------- | ---------- | ------ | ---------- |
| D-04 | WHAT  | other-feature/rate-limit-response | What HTTP status and body should a rate-limited request receive? | `429 Too Many Requests` with a `Retry-After` header and a JSON body `{ "error": "rate_limited" }`. | As recommended. | yes            | —          | @llipe | 2026-08-02 |
