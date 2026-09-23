# Traceability Matrix — infra-engineer

**Status:** Design complete  
**Scope:** Task 0 and Stories S-001–S-010 / issues #153–#163  
**Source:** `workstream/user-stories-infra-engineer.md` v1.1 and `workstream/specification-infra-engineer.md` v1.0  
**Test plan:** `workstream/test-plan-infra-engineer.md`

## Result legend

- **Planned:** Test-first scenario designed; implementation has not supplied evidence yet.
- **Pass / Fail / Drift:** Reserved for Audit Mode after implementation.
- **Blocked:** Required evidence or safe environment unavailable; state the reason rather than claiming coverage.

Every AC maps to at least one positive and one negative/edge assertion. Test IDs refer to the consolidated plan. “Automated” means committed deterministic test; manual scenarios remain required supplemental evidence where shown.

## Task 0 — branch convention hygiene (#153)

| Requirement                              | Positive test(s)                                                  | Negative / edge test(s)                                        | Evidence / status                         |
| ---------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| T0.1 `git-ops` uses `integration/…`      | CP-01: three-tree canonical branch example                        | CP-01: `integrate/…` grep mutation fails                       | Automated parity/content search — Planned |
| T0.2 only issue/story/integration types  | CP-01: identical tables enumerate three types                     | CP-01: re-add `fix`, `chore`, `docs` row fails                 | Automated — Planned                       |
| T0.3 merge strategy/authority consistent | CP-01: issue/story squash and integration merge-commit assertions | CP-01: contrary main authority text fails                      | Automated — Planned                       |
| T0.4 no stale branch examples            | CP-01: all trees plus docs search returns no stale examples       | CP-01: seeded stale example detected                           | Automated — Planned                       |
| T0.5 cross-tree AC                       | CP-01: canonical tables equivalent                                | CP-01: one-tree wording divergence detected                    | Automated — Planned                       |
| T0.6 quality                             | Unit/format commands pass                                         | Deliberately malformed Markdown/format fixture fails formatter | Automated — Planned                       |

## Story S-001 — infra-engineer contract and environment template (#154)

| AC                              | Positive test(s)                                                                    | Negative / edge test(s)                                                                    | Evidence / status                   |
| ------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| AC-1 platform files/frontmatter | CP-02 structural file and Kiro frontmatter assertions                               | CP-02 missing file, Claude duplicate, empty variant, `permissions` mutation                | Automated — Planned                 |
| AC-2 unskippable working loop   | CP-02 required lifecycle/approval wording; CP-03 one-step manual prompt             | CP-03 second write without step approval and batch/autonomous request blocked              | Automated + manual — Planned        |
| AC-3 schema/state machine       | CP-02 normative fields and lifecycle states                                         | EC-02 invalid/re-entrant transition rejected                                               | Automated + property — Planned      |
| AC-4 revert rule                | CP-03 valid reversible step and reverse rollback record                             | CP-02/EC-02 empty production revert; unaccepted non-prod `none`; bad destroy order blocked | Automated + manual — Planned        |
| AC-5 backup rule                | CP-03 production stateful step records backup id/restore command before apply       | CP-03 production stateful step without backup blocked                                      | Automated + manual — Planned        |
| AC-6 tiers/destroy              | CP-03 foundation routes rather than applies; ephemeral destroy plan reverse ordered | CP-03 production foundation destroy/no typed environment blocked                           | Automated + manual — Planned        |
| AC-7 identity assertion         | CP-02/CP-03 probe and matching environment identity accepted                        | CP-02 wrong AWS/Fly/Supabase identity blocked                                              | Automated + stub/manual — Planned   |
| AC-8 tool check                 | CP-02 declares probe/floor/auth/remediation                                         | CP-02 missing/below-floor/unauthenticated tool blocks; no auto-install                     | Automated + stubs — Planned         |
| AC-9 routing table              | CP-02 asserts every specified row                                                   | CP-02 row removal/misowned tool mutation fails                                             | Automated — Planned                 |
| AC-10 cost rule                 | CP-03 records estimate/source and threshold approval                                | EC-07 equal threshold, invalid cost, unnamed approval fails                                | Automated + manual — Planned        |
| AC-11 records/inventory         | CP-03 validates plan/commands/rollback/result/inventory structure                   | CT-02 malformed ChangeId, literal secret, absent required result field fails               | Automated + manual — Planned        |
| AC-12 tags/secrets/logs         | CP-02 policy assertions; CP-07 secret-safe output; CP-08 tag guard                  | EC-08 unbounded log request; secret literal/tag request blocked                            | Automated + manual — Planned        |
| AC-13 Cloudflare DNS/certs      | CP-02 documents capture/revert steps                                                | CP-03 no prior value/revert blocks update                                                  | Automated/manual contract — Planned |
| AC-14 template environments     | CT-01 valid filled file resolves                                                    | CP-02/CT-01 template/missing/absent platform blocks                                        | Automated + manual — Planned        |
| AC-15 parity test               | CP-02 test passes across variants                                                   | CP-02 mutation of each contract assertion fails                                            | Automated — Planned                 |

## Story S-002 — aws-ops (#155)

| AC                    | Positive test(s)                                             | Negative / edge test(s)                                   | Evidence / status            |
| --------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| AC-1 three-tree skill | CP-04 identical body assertion                               | CP-04 missing/divergent copy fails                        | Automated — Planned          |
| AC-2 CLI declaration  | CP-04 probe/floor/auth/remediation asserted                  | CP-04 missing CLI, v1, unauthenticated result blocks      | Automated — Planned          |
| AC-3 command sets     | CP-04 required discover/ECR/ECS/IAM/secret/ACM/ALB/log terms | CP-04 literal secret or foundation apply command rejected | Automated — Planned          |
| AC-4 tiers            | CP-04 required tier mapping present                          | CP-04 foundation resource application is routed           | Automated — Planned          |
| AC-5 cost             | CP-04 sources and always-relevant cost list asserted         | EC-07 invalid/missing estimate is flagged                 | Automated — Planned          |
| AC-6 backup/revert    | CP-04 RDS/S3 backup and revision/image reverts present       | CP-04 IAM plan without detach/delete revert fails         | Automated + manual — Planned |
| AC-7 logs             | CP-04 all AWS log sources/bounds present                     | EC-08 unbounded Logs Insights request refused             | Automated — Planned          |
| AC-8 sweep            | CP-04 all sweep categories present                           | CP-04 one category omission fails                         | Automated — Planned          |
| AC-9 parity           | CP-04 parity suite green                                     | CP-04 fixture divergence fails                            | Automated — Planned          |

## Story S-003 — fly-ops (#156)

| AC                    | Positive test(s)                                                           | Negative / edge test(s)                                     | Evidence / status            |
| --------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------- |
| AC-1 three-tree skill | CP-05 identical body assertion                                             | CP-05 missing/divergent copy fails                          | Automated — Planned          |
| AC-2 tool declaration | CP-05 probe/floor/auth/remediation present                                 | CP-05 missing/below-floor/wrong identity blocks             | Automated — Planned          |
| AC-3 command sets     | CP-05 app/deploy/secret/volume/cert/scale/machine/destroy commands present | CP-05 unsupported/missing command set fails                 | Automated — Planned          |
| AC-4 tiers            | CP-05 org/application/ephemeral mapping accepted                           | CP-05 ephemeral resource without `ExpiresAt` flagged        | Automated + manual — Planned |
| AC-5 revert           | CP-05 releases/image and source-of-truth secret revert shown               | EC-04 duplicate/bad rollback and transcript secret rejected | Manual + contract — Planned  |
| AC-6 backup           | CP-05 volume snapshot requirement present                                  | CP-05 production volume step without snapshot blocked       | Automated + manual — Planned |
| AC-7 logs             | CP-05 bounded log/status/machine/release table present                     | EC-08 no `--since` query refused                            | Automated — Planned          |
| AC-8 cost/sweep       | CP-05 machine/volume/IP costs and sweep present                            | CP-05 missing stopped/unattached/expired category fails     | Automated — Planned          |
| AC-9 parity           | CP-05 suite green                                                          | CP-05 mutation fails                                        | Automated — Planned          |

## Story S-004 — supabase-ops (#157)

| AC                    | Positive test(s)                                                        | Negative / edge test(s)                                                 | Evidence / status                     |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| AC-1 three-tree skill | CP-06 identical body assertion                                          | CP-06 missing/divergent copy fails                                      | Automated — Planned                   |
| AC-2 CLI declaration  | CP-06 probe/floor/auth/remediation present                              | CP-06 missing/v1/unauthenticated blocks                                 | Automated — Planned                   |
| AC-3 tiers            | CP-06 foundation/application/preview tiers present                      | CP-06 production foundation delete blocked                              | Automated — Planned                   |
| AC-4 migration flow   | CP-06 `db diff`, itemization, confirmation, verification behavior       | CP-06 drift with no migration never pushes; no confirmation blocks push | Automated + manual — Planned          |
| AC-5 backup           | CP-06 dump/PITR before prod data/schema behavior                        | CP-06 missing backup blocks                                             | Automated + manual — Planned          |
| AC-6 discovery        | CP-06 MCP-read-only → CLI → API ordering stated                         | CP-06 MCP write rejects                                                 | Automated — Planned                   |
| AC-7 inventory        | CP-06 fields/findings without keys accepted                             | CP-06 key-shaped content, omitted legacy/RLS finding fails              | Automated + CP-07 — Planned           |
| AC-8 secrets          | CP-06 Edge secret/publishable distinction present                       | CP-06 AWS-manager misuse or raw secret rejected                         | Automated — Planned                   |
| AC-9 logs             | CP-06 all log categories/retention/capture rule and researcher citation | EC-08 unbounded query or uncited endpoint fails                         | Automated + research review — Planned |
| AC-10 cost/sweep      | CP-06 required cost/sweep list present                                  | CP-06 category omission fails                                           | Automated — Planned                   |
| AC-11 parity          | CP-06 suite green                                                       | CP-06 mutation fails                                                    | Automated — Planned                   |

## Story S-005 — redaction (#158)

| AC                           | Positive test(s)                                                  | Negative / edge test(s)                                      | Evidence / status           |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| AC-1 pattern file/categories | CP-07 validates regex/comment/category set                        | CP-07 missing category/invalid expression fails              | Automated — Planned         |
| AC-2 transform behavior      | CP-07 each supported synthetic line becomes categorized redaction | CP-07 two-secret, JSON, uppercase URI, and benign line tests | Automated + RT-01 — Planned |
| AC-3 unit test exists/runs   | CP-07 test suite executes fixture set                             | CP-07 intentional leaking fixture fails                      | Automated — Planned         |
| AC-4 repository scan         | CP-07 scan has no fixture shape                                   | CP-07 seeded matching text in each scan root fails           | Automated — Planned         |
| AC-5 mandatory filter policy | CP-02 all agent variants state filter/no raw output               | CP-02 phrase removal fails                                   | Automated — Planned         |

## Story S-006 — Phase 1 registry, ADR, manifest (#159)

| AC                       | Positive test(s)                                                        | Negative / edge test(s)                                              | Evidence / status                 |
| ------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| AC-1 registries          | CP-11 all docs/templates/counts/rationale present                       | CP-11 omitted file/agent/skill/count mismatch fails                  | Automated — Planned               |
| AC-2 ADR                 | CP-11 ADR-005 and index have all required sections                      | CP-11 missing Context/Decision/Consequences/Alternatives/index fails | Automated/content check — Planned |
| AC-3 manifest/package    | CT-08 managed `templates/infra`, owned `infra/`, package files accepted | CT-08 missing path/incorrect prefix fails                            | Automated — Planned               |
| AC-4 distribution prefix | CP-10 scratch install/update preserves filled owned file                | EC-10 populated-prefix and absent-prefix variants                    | Automated + manual — Planned      |
| AC-5 gates/reachability  | CP-10 full test/validate/audit green                                    | Test omitted from aggregator/reachable suite detected                | Automated — Planned               |

## Story S-007 — tag policy and guard (#160)

| AC                     | Positive test(s)                                                    | Negative / edge test(s)                                 | Evidence / status            |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| AC-1 Tags docs         | CP-08 exact annotated/human/main/immutable/milestone policy present | CP-08 prerelease/movable/non-main policy mutation fails | Automated — Planned          |
| AC-2 git-ops procedure | CP-08 annotated-create/push-one/verify-main/hotfix present          | CP-08 missing procedure step fails                      | Automated — Planned          |
| AC-3 hook rule         | CP-08 allow matrix exits 0                                          | CP-08 all mutation/release/combined push matrix exits 2 | Automated + manual — Planned |
| AC-4 workflow filters  | CP-08 exact semver filter assertions pass                           | CP-08 wildcard/prerelease/bad regex mutation fails      | Automated — Planned          |
| AC-5 hook tests        | CP-08 test passes                                                   | RT-04 generated command variants fail closed            | Automated — Planned          |
| AC-6 guidelines policy | CP-08 deployment one-line reference present                         | CP-08 removal fails                                     | Automated — Planned          |

## Story S-008 — deploy-ops and scripts (#161)

| AC                       | Positive test(s)                                                 | Negative / edge test(s)                                             | Evidence / status            |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| AC-1 skill contract      | CP-09/CT-03 mapping/tag/decision/scaffold/tools present          | CP-09 missing tool/table/contract fails                             | Automated — Planned          |
| AC-2 scripts/basic flags | CP-09 `bash -n`, strict mode, help, dry-run applicable scripts   | CP-09 syntax error/unknown flag/help absence fails                  | Automated — Planned          |
| AC-3 deploy sequence     | CP-09 stub argv follows ordered flow and blocks unsafe bypass    | CP-09 dirty/ref/identity/validate/backup skip attempts block        | Automated + RT-03 — Planned  |
| AC-4 production ref      | CP-09 annotated main tag accepted                                | CP-09 non-tag/lightweight/off-main tag rejected                     | Automated — Planned          |
| AC-5 verify exit         | CP-09 healthy exits 0; unhealthy exit 3 prints exact rollback    | CP-09 missing/wrong rollback text fails                             | Automated + manual — Planned |
| AC-6 rollback resolution | CP-09 history selects prior good version; `--to` overrides       | EC-04 empty history/repeated rollback/invalid version blocks safely | Automated — Planned          |
| AC-7 release behavior    | CP-09 dry-run has no writes and asks suggested bump confirmation | CP-09 CI/noninteractive/release write in dry-run blocks/fails       | Automated — Planned          |
| AC-8 environment parsing | CT-01 valid declared environment resolves via yq                 | CT-01 missing/template/ambiguous/missing-yq returns 2               | Automated — Planned          |
| AC-9 contract test       | CP-09 complete test green; shellcheck recorded                   | CP-09 stub detects real write during dry run                        | Automated — Planned          |
| AC-10 parity             | CP-09 skill parity green                                         | CP-09 body divergence fails                                         | Automated — Planned          |

## Story S-009 — workflow templates and Phase 2 registration (#162)

| AC                               | Positive test(s)                                            | Negative / edge test(s)                                    | Evidence / status   |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| AC-1 workflow behavior           | CP-10 valid dev/prod/rollback YAML triggers/calls scripts   | CP-10 missing trigger/input/environment fails              | Automated — Planned |
| AC-2 tool setup/no inline deploy | CP-10 pinned OIDC/tool setup and scripts-only content       | CP-10 inline platform CLI deployment/unpinned action fails | Automated — Planned |
| AC-3 scaffold condition          | CP-10 nonproduction environment installs dev workflow       | CP-10 all-production/no-nonprod config omits dev workflow  | Automated — Planned |
| AC-4 manifest ownership          | CT-08 managed templates and owned installed workflows       | EC-10 update over edited workflow preserves content        | Automated — Planned |
| AC-5 registries/guidelines       | CP-11 script list and all registries mention deploy assets  | CP-11 missing registry/guideline item fails                | Automated — Planned |
| AC-5b caller handoff             | CP-11 planner and chain include post-integration handoff    | CP-11 absent conditional handoff fails                     | Automated — Planned |
| AC-6 workflow tests              | CP-10 parser/trigger/environment/no-inline assertions green | CP-10 malformed YAML/filter mutation fails                 | Automated — Planned |
| AC-7 gates                       | CP-10 validate/audit green                                  | Aggregate omission/failure reported                        | Automated — Planned |

## Story S-010 — caller wiring and chains (#163)

| AC                            | Positive test(s)                                                             | Negative / edge test(s)                                                      | Evidence / status            |
| ----------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| AC-1 developer routing        | CP-11 developer refuses shared/cloud platform write and names infra-engineer | EC-11 local `.env.example` remains developer; broad exemption mutation fails | Automated + manual — Planned |
| AC-2 implement routing        | CP-11 all three implement surfaces carry rule                                | CP-11 omitted tree/platform write allowance fails                            | Automated — Planned          |
| AC-3 housekeeping boundary    | CP-11 never-touch table contains all specified paths                         | EC-11 deploy lint error remains untouched; entry omission fails              | Automated + manual — Planned |
| AC-4 planner routing          | CP-11 conditional per-story rule plus S-009 handoff                          | EC-11 no-infra story invokes nothing; unconditional wording fails            | Automated — Planned          |
| AC-5 product-engineer routing | CP-11 infra recommendation and drift route present                           | CP-11 omitted conditional/drift route fails                                  | Automated — Planned          |
| AC-6 github-ops record PR     | CP-11 title/body/ChangeId/label shape present                                | CP-11 missing PR component fails                                             | Automated — Planned          |
| AC-7 reverse direction        | CP-02 researcher conditional + verifier applicability wording present        | CP-02 absent/mandatory researcher invocation fails                           | Automated — Planned          |
| AC-8 workflow chains          | CP-11 Infrastructure Change + conditional handoff headings/steps present     | CP-11 missing lifecycle step/chain heading fails                             | Automated — Planned          |
| AC-9 caller parity            | CP-11 every caller path has reference and conditional pattern                | CP-11 remove one path/reference/pattern fails                                | Automated — Planned          |
| AC-10 validate/reachability   | CP-11 unit and validate pass                                                 | Aggregate suite omission detected                                            | Automated — Planned          |

## Coverage summary

| Scope  | ACs / requirements mapped | Positive coverage          | Negative/edge coverage           | Status            |
| ------ | ------------------------: | -------------------------- | -------------------------------- | ----------------- |
| Task 0 |                         6 | CP-01                      | CP-01                            | Covered / Planned |
| S-001  |                        15 | CP-02, CP-03, CT-01, CT-02 | CP-02, CP-03, EC-01–EC-08, RT-02 | Covered / Planned |
| S-002  |                         9 | CP-04                      | CP-04, EC-07–EC-09               | Covered / Planned |
| S-003  |                         9 | CP-05                      | CP-05, EC-04, EC-08              | Covered / Planned |
| S-004  |                        11 | CP-06                      | CP-06, EC-05, EC-08–EC-09        | Covered / Planned |
| S-005  |                         5 | CP-07                      | CP-07, EC-07, RT-01              | Covered / Planned |
| S-006  |                         5 | CP-10, CP-11, CT-08        | CP-10, EC-10, RT-05              | Covered / Planned |
| S-007  |                         6 | CP-08                      | CP-08, EC-06, RT-04              | Covered / Planned |
| S-008  |                        10 | CP-09, CT-01, CT-06        | CP-09, EC-01–EC-07, RT-03        | Covered / Planned |
| S-009  |              7 plus AC-5b | CP-10, CP-11, CT-07–CT-08  | CP-10, EC-10                     | Covered / Planned |
| S-010  |                        10 | CP-11                      | CP-11, EC-11                     | Covered / Planned |

**AC coverage status:** 100% designed; 0% executed. Audit Mode MUST replace each `Planned` status with observed evidence after implementation, or mark it `Blocked` with missing evidence.
