/**
 * Issue #339: git-guard judges pushes, merges and tags by the commands that
 * actually run, not by text that only mentions them.
 *
 * Before #339 the Claude hook read heredoc bodies and `printf`/`echo`/`cat`
 * arguments as commands, and an apostrophe inside a quoted heredoc body
 * (`don't`) opened a phantom quote, so a later `gh pr create --base main` was
 * read as a push to `main`. The hook now builds an "executed view" for rules 1
 * and 4: when every segment starts with `git`, `gh`, `echo`, `printf` or
 * `cat` and nothing in the command can run code, heredoc bodies and
 * `printf`/`echo`/`cat` arguments are ignored. Anything else is strict, which
 * is the old behavior (decisions-issue-339.md D-01, D-02).
 *
 * Claude hook only (D-03); the Kiro hook is tracked in #340.
 *
 * Ported matrices (D-05), from llipe/riel `scripts/git-guard.test.ts` at riel
 * d8ccd8bb331306df1c25fe4e76a4ffb584acc2e9 (riel#771 merged as b990b8b; the
 * file is unchanged between the two):
 *   - riel#771 "executed merge and push forms stay blocked": 68 rows, verbatim
 *     and in order (TC-MB-01 to TC-MB-68), plus its rule-2, rule-3 and tag rows.
 *   - riel#771 "over-block, accepted until #770": 16 text-only rows, verbatim
 *     (TC-TO-01 to TC-TO-16), plus the 3 forms listed on riel#770 (TC-TR-01
 *     to TC-TR-03, D-11). None of the 19 passes an inline `--body`, so the
 *     rule-3 exception set is empty. The forms using an unquoted `<<EOF` or a
 *     `<<<` here-string stay blocked as accepted over-blocks (D-10): bash
 *     expands both, so they are never relaxed.
 *
 * Case IDs follow workstream/test-plan-issue-339-git-guard-push-false-positive.md.
 * Merge and push-to-main text is assembled from parts, so it never appears
 * literally in this file and an agent editing it is not blocked by its own
 * guard.
 */
import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const HOOK = resolve(ROOT, ".claude/hooks/git-guard.sh");
const STUB_BIN = resolve(ROOT, "test/fixtures/git-guard/bin");

type Env = Readonly<Record<string, string>>;

/** Stub defaults: the push and tag rules never call `gh pr view`. */
const ENV_0: Env = {};
/** A PR merge resolves to base `main`, so a real merge blocks on its base. */
const ENV_B: Env = { GIT_GUARD_STUB_PR_BASE: "main" };
/** Every `gh pr view` lookup fails, so exit 0 proves no lookup ran (AC-4). */
const ENV_F: Env = { GIT_GUARD_STUB_PR_BASE_EXIT: "1" };
/** A PR merge resolves to a non-default base. Controls only. */
const ENV_X: Env = { GIT_GUARD_STUB_PR_BASE: "feat/x" };

interface HookResult {
  status: number;
  stderr: string;
}

function runPayload(payload: string, env: Env = ENV_0): HookResult {
  const result = spawnSync("bash", [HOOK], {
    input: payload,
    encoding: "utf-8",
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: `${STUB_BIN}${delimiter}${process.env.PATH ?? ""}`,
      GIT_GUARD_STUB_DEFAULT_BRANCH: "main",
      ...env,
    },
  });
  return { status: result.status ?? -1, stderr: result.stderr };
}

function runHook(command: string, env: Env = ENV_0): HookResult {
  return runPayload(JSON.stringify({ tool_input: { command } }), env);
}

const QA_MERGE = "gh pr " + "merge 5 --merge";
const QA_PUSH = "git push origin " + "main";
const F = "feat/x";
const pushTo = (ref: string) => "git push origin " + ref;

/** A heredoc commit with a valid subject, so rule 2 never confounds rule 1. */
const hc = (body: string, opener = "<<'EOF'") =>
  `git commit -q -F - ${opener}\nfix(hooks): subject\n\n${body}\nEOF`;

type Case = readonly [id: string, command: string, env: Env, expected: 0 | 2];

function cases(list: readonly Case[]): void {
  it.each(list)("%s", (_id, command, env, expected) => {
    expect(runHook(command, env).status, command).toBe(expected);
  });
}

describe("issue #339 / apostrophe in heredoc (AC-1)", () => {
  cases([
    [
      "TC-A1-01: heredoc commit with don't, feature push, PR against main",
      `${hc("we don't push here")}\ngit push -u origin ${F}\ngh pr create --base main --head ${F} --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-02: the chain on the heredoc opener line",
      `git commit -q -F - <<'EOF' && git push -u origin ${F} && gh pr create --base main --title t --body-file f\nfix(hooks): subject\n\nthe owner's note\nEOF`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-03: push output filtered through grep (strict mode)",
      `${hc("don't")}\ngit push -u origin ${F} 2>&1 | grep -v '^remote'\ngh pr create --base main --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-04: riel Case 1 shape (strict mode)",
      `cd /tmp && git add a && ${hc("we don't push main here")}\ngit push -q -u origin ${F} 2>&1 | grep -v '^remote'\nprintf '%s\\n' "## Summary" "Targets \\\`main\\\` via PR" > body.md\ngh pr create --base main --head ${F} --title t --body-file body.md 2>&1 | tail -1`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-05: riel Case 1 shape with allow-listed words only",
      `git add a && ${hc("we don't push main here")}\ngit push -q -u origin ${F}\nprintf '%s\\n' '## Summary' 'Targets main via PR' > body.md\ngh pr create --base main --head ${F} --title t --body-file body.md`,
      ENV_0,
      0,
    ],
    [
      'TC-A1-06: a double-quoted delimiter (<<"EOF")',
      `${hc("don't", '<<"EOF"')}\ngit push -u origin ${F}\ngh pr create --base main --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-07: an unbalanced double quote in the body",
      `${hc('say "hi')}\ngit push -u origin ${F}\ngh pr create --base main --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-08: issue row 1",
      `git push -u origin ${F} 2>&1 | grep -v '^remote'; gh pr create --base main --head ${F} --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-09: issue row 2",
      `git push -u origin ${F}; gh pr create --base main --head ${F} --title t --body-file f`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-10: issue row 3 (no apostrophe)",
      `${hc("msg mentioning main")}\ngit push -u origin ${F}`,
      ENV_0,
      0,
    ],
    [
      "TC-A1-N1: a real push to main after the heredoc",
      `${hc("don't")}\n${QA_PUSH}\ngh pr create --base main --title t --body-file f`,
      ENV_0,
      2,
    ],
    [
      "TC-A1-N2: a feature push chained with a push to main",
      `${hc("don't")}\ngit push -u origin ${F} && ${QA_PUSH}`,
      ENV_0,
      2,
    ],
    [
      "TC-A1-N3: strict mode, apostrophe body, push to HEAD:main",
      `cd x && ${hc("don't")}\n${pushTo("HEAD:main")}`,
      ENV_0,
      2,
    ],
  ]);
});

describe("issue #339 / non-executed text (AC-2)", () => {
  cases([
    ["TC-A2-01: issue row 4, printf to a file", `printf '%s' "${QA_PUSH}" > f.txt`, ENV_0, 0],
    [
      "TC-A2-02: issue row 5, cat heredoc to a file",
      `cat > f.sh <<'EOF'\n${QA_PUSH}\nEOF`,
      ENV_0,
      0,
    ],
    ["TC-A2-03: single-quoted printf", `printf '%s' '${QA_PUSH}' > f.txt`, ENV_0, 0],
    ["TC-A2-04: echo appended to a file", `echo "${QA_PUSH}" >> notes.md`, ENV_0, 0],
    ["TC-A2-05: a double-quoted delimiter", `cat > f.sh <<"EOF"\n${QA_PUSH}\nEOF`, ENV_0, 0],
    [
      "TC-A2-06: issue Case 2 shape",
      `cat > f.sh <<'OUTER'\n${QA_PUSH}; gh pr create --base main\nOUTER`,
      ENV_0,
      0,
    ],
    ["TC-A2-N1: a real push after a printf", `printf '%s' "x" > f.txt && ${QA_PUSH}`, ENV_0, 2],
    [
      "TC-A2-N2: a real push after the heredoc closes",
      `cat > f.sh <<'EOF'\nnote\nEOF\n${QA_PUSH}`,
      ENV_0,
      2,
    ],
    [
      "TC-A2-N3: an unquoted delimiter stays strict (accepted over-block, D-10)",
      `cat > f.sh <<EOF\n${QA_PUSH}\nEOF`,
      ENV_0,
      2,
    ],
  ]);
});

// riel `scripts/git-guard.test.ts`, "over-block, accepted until #770",
// verbatim and in order.
const RIEL_TEXT_ONLY: readonly (readonly [string, string])[] = [
  [
    "a quoted heredoc body on gh issue create",
    `gh issue create --title "x" --body-file - <<'EOF'\nRun \`${QA_MERGE} --delete-branch\` after review.\nEOF`,
  ],
  [
    "a heredoc body whose line starts with a merge",
    `gh pr comment 5 --body-file - <<'EOF'\n${QA_MERGE}\nEOF`,
  ],
  [
    'a double-quoted heredoc delimiter (<<-"EOF")',
    `gh issue comment 5 --body-file - <<-"EOF"\n\t${QA_MERGE}\n\tEOF`,
  ],
  [
    "an unquoted delimiter whose body runs nothing",
    `gh pr create --title "x" --body-file - <<EOF\nthen ${QA_MERGE}\nEOF`,
  ],
  [
    "a gh comment heredoc body naming a push to main",
    `gh issue comment 5 --body-file - <<'EOF'\n${QA_PUSH}\nEOF`,
  ],
  ["a single-quoted here-string body", `gh issue comment 5 --body-file - <<< '${QA_MERGE}'`],
  ["a#b in a here-string body", `gh issue comment 5 --body-file - <<< 'a#b ${QA_MERGE}'`],
  [
    "a quoted printf piped into --body-file -",
    `printf '%s\\n' 'Merge with ${QA_MERGE}' | gh pr create --title "x" --body-file -`,
  ],
  [
    "a double-quoted echo piped into --body-file -",
    `echo "next: ${QA_MERGE}" | gh issue comment 5 --body-file -`,
  ],
  ["$# before a quoted body", `echo $# '${QA_MERGE}' | gh issue comment 5 --body-file -`],
  [
    "a # inside a double-quoted body",
    `echo "see #12: ${QA_MERGE}" | gh issue comment 5 --body-file -`,
  ],
  [
    "a quoted cat heredoc into gh issue create",
    `cat <<'EOF' | gh issue create --title x --body-file -\n${QA_MERGE}\n${QA_PUSH}\nEOF`,
  ],
  ["a single-quoted echo to a file", `echo '${QA_MERGE}' > notes.txt`],
  ["a printf appended to a file", `printf '%s\\n' '${QA_PUSH}' >> notes.md`],
  [
    "a quoted-delimiter cat heredoc to a file",
    `cat <<'EOF' > notes.md\n${QA_MERGE}\n${QA_PUSH}\nEOF`,
  ],
  ["a double-quoted echo naming a push", `echo "run ${QA_PUSH} later"`],
];

/** Env and expected exit per RIEL_TEXT_ONLY row, with the reason for a 2. */
const TEXT_ONLY_EXPECT: readonly (readonly [Env, 0 | 2, string?])[] = [
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 2, "an unquoted heredoc is expanded by bash (D-10)"],
  [ENV_0, 0],
  [ENV_F, 2, "a <<< here-string is expanded by bash (D-10)"],
  [ENV_F, 2, "a <<< here-string is expanded by bash (D-10)"],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_F, 0],
  [ENV_0, 0],
  [ENV_F, 0],
  [ENV_0, 0],
];

describe("riel#770 text-only forms (AC-3)", () => {
  it("ports all 16 pinned rows", () => {
    expect(RIEL_TEXT_ONLY).toHaveLength(16);
    expect(TEXT_ONLY_EXPECT).toHaveLength(16);
  });

  cases(
    RIEL_TEXT_ONLY.map(([label, command], i): Case => {
      const [env, expected, reason] = TEXT_ONLY_EXPECT[i] as (typeof TEXT_ONLY_EXPECT)[number];
      const id = `TC-TO-${String(i + 1).padStart(2, "0")}: ${label}`;
      return [reason ? `${id} (accepted over-block: ${reason})` : id, command, env, expected];
    }),
  );

  cases([
    [
      "TC-TR-01: an ANSI-C here-string split by a continuation (accepted over-block, D-10)",
      `gh issue comment 5 --body-file - <<< $'note: ${QA_MERGE}\\\n done'`,
      ENV_F,
      2,
    ],
    [
      "TC-TR-02: an echo piped with |& into gh",
      `echo '${QA_MERGE}' |& gh issue comment 5 --body-file -`,
      ENV_F,
      0,
    ],
    [
      "TC-TR-03: an echo piped into gh on the next line",
      `echo '${QA_MERGE}' |\ngh issue comment 5 --body-file -`,
      ENV_F,
      0,
    ],
    [
      "TC-A3-R1: rule 3 still blocks an inline --body",
      `gh issue comment 5 --body "line1\nline2 ${QA_MERGE}"`,
      ENV_F,
      2,
    ],
  ]);
});

describe("riel#770 text-only forms / merge mentions skip the base lookup (AC-4)", () => {
  const afterHeredoc = `gh issue comment 5 --body-file - <<'EOF'\nnote\nEOF\n${QA_MERGE}`;
  cases([
    [
      "TC-A4-01: a heredoc body naming a merge",
      `gh issue comment 5 --body-file - <<'EOF'\nRun ${QA_MERGE} after review.\nEOF`,
      ENV_F,
      0,
    ],
    [
      "TC-A4-02: the same command with a main base",
      `gh issue comment 5 --body-file - <<'EOF'\nRun ${QA_MERGE} after review.\nEOF`,
      ENV_B,
      0,
    ],
    [
      "TC-A4-03: the body line is the merge text",
      `gh pr comment 5 --body-file - <<'EOF'\n${QA_MERGE}\nEOF`,
      ENV_F,
      0,
    ],
    [
      "TC-A4-04: a printf piped into gh pr create",
      `printf '%s\\n' 'Merge with ${QA_MERGE}' | gh pr create --title x --body-file -`,
      ENV_F,
      0,
    ],
    [
      "TC-A4-05: gh issue create with a merge in the body",
      `gh issue create --title x --body-file - <<'EOF'\nAfter review run ${QA_MERGE}.\nEOF`,
      ENV_F,
      0,
    ],
    [
      "TC-A4-06: gh pr create --base main with push text and an apostrophe",
      `gh pr create --title x --base main --body-file - <<'EOF'\nThen ${QA_PUSH} is forbidden; don't.\nEOF`,
      ENV_0,
      0,
    ],
    [
      "TC-A4-07: an apostrophe before the merge text",
      `gh issue comment 5 --body-file - <<'EOF'\nOwner's step: ${QA_MERGE}\nEOF`,
      ENV_F,
      0,
    ],
    ["TC-A4-N1: a real merge after the heredoc closes", afterHeredoc, ENV_B, 2],
    ["TC-A4-N2: a real merge still fails closed", afterHeredoc, ENV_F, 2],
    ["TC-A4-C1: a real merge into a non-default base is allowed", afterHeredoc, ENV_X, 0],
  ]);
});

// riel `scripts/git-guard.test.ts`, "executed merge and push forms stay
// blocked (#767)", verbatim and in order: TC-MB-NN is the NN-th row.
const RIEL_MUST_BLOCK: readonly (readonly [string, string])[] = [
  // Shell runners and command prefixes.
  ["bash -c with a single-quoted merge", `bash -c '${QA_MERGE}'`],
  ["sh -c with a single-quoted merge", `sh -c '${QA_MERGE}'`],
  ["zsh -c with a single-quoted merge", `zsh -c '${QA_MERGE}'`],
  ["eval of a single-quoted merge", `eval '${QA_MERGE}'`],
  ["env bash -c with a single-quoted merge", `env bash -c '${QA_MERGE}'`],
  ["a command prefix", `command ${QA_MERGE}`],
  ["an exec prefix", `exec ${QA_MERGE}`],
  ["command bash -c", `command bash -c '${QA_MERGE}'`],
  ["/bin/sh -c", `/bin/sh -c '${QA_MERGE}'`],
  ["env -i sh -c", `env -i sh -c '${QA_MERGE}'`],
  ["nohup sh -c", `nohup sh -c '${QA_MERGE}'`],
  ["time bash -c", `time bash -c '${QA_MERGE}'`],
  ["sudo sh -c", `sudo sh -c '${QA_MERGE}'`],
  ["bash -c with an ANSI-C quoted merge", `bash -c $'${QA_MERGE}'`],
  ["a double-quoted bash -c", `bash -c "${QA_MERGE}"`],
  ["a push to main in a single-quoted bash -c", `bash -c '${QA_PUSH}'`],
  ["xargs supplying the PR number", "echo 5 | xargs gh pr " + "merge"],
  ["xargs running a single-quoted sh -c", "xargs -I{} sh -c 'gh pr " + "merge {}' <<< 5"],
  // Text piped or fed into a shell.
  ["a single-quoted echo piped into bash", `echo '${QA_MERGE}' | bash`],
  ["a single-quoted echo piped into sh", `echo '${QA_MERGE}' | sh`],
  ["a single-quoted printf piped into sh", `printf '${QA_MERGE}' | sh`],
  ["an echo piped into source /dev/stdin", `echo '${QA_MERGE}' | source /dev/stdin`],
  ["a quoted-delimiter heredoc fed to bash", `bash <<'EOF'\n${QA_MERGE}\nEOF`],
  ["a cat heredoc piped into bash", `cat <<'EOF' | bash\n${QA_MERGE}\nEOF`],
  ["a bash here-string", `bash <<< '${QA_MERGE}'`],
  ["a pipe continued on the next line into bash", `echo '${QA_MERGE}' |\nbash`],
  ["a pipe, a comment, then bash on the next line", `echo '${QA_MERGE}' |# c\nbash`],
  ["(echo '<merge>'; echo) | bash", `(echo '${QA_MERGE}'; echo) | bash`],
  ["{ echo x; echo '<merge>'; } | bash", `{ echo x; echo '${QA_MERGE}'; } | bash`],
  ["echo '<merge>' > x.sh; bash x.sh", `echo '${QA_MERGE}' > x.sh; bash x.sh`],
  ["cat <<'EOF' > x.sh; bash x.sh (same line)", `cat <<'EOF' > x.sh; bash x.sh\n${QA_MERGE}\nEOF`],
  ["cat <<'EOF' > x.sh, then bash x.sh", `cat <<'EOF' > x.sh\n${QA_MERGE}\nEOF\nbash x.sh`],
  ["cat <<'EOF' > x.sh; bash x.sh pushing main", `cat <<'EOF' > x.sh; bash x.sh\n${QA_PUSH}\nEOF`],
  // Command and process substitution.
  ["echo $(sh -c '<merge>')", `echo $(sh -c '${QA_MERGE}')`],
  ["echo `sh -c '<merge>'`", "echo `sh -c '" + QA_MERGE + "'`"],
  ['echo $(sh -c "<merge>")', `echo $(sh -c "${QA_MERGE}")`],
  ["echo $(sh -c '<push main>')", `echo $(sh -c '${QA_PUSH}')`],
  [
    "gh pr comment --body-file <(sh -c '<merge>')",
    `gh pr comment 5 --body-file <(sh -c '${QA_MERGE}')`,
  ],
  ["echo '<merge>' > >(bash)", `echo '${QA_MERGE}' > >(bash)`],
  ["tee >(bash) into gh", `echo '${QA_MERGE}' | tee >(bash) | gh issue comment 5 --body-file -`],
  [
    "an unquoted-delimiter gh heredoc whose body substitutes a merge",
    `gh issue comment 5 --body-file - <<EOF\n$(${QA_MERGE})\nEOF`,
  ],
  [
    "an env-prefixed gh heredoc whose body substitutes a merge",
    `X=1 gh issue comment 5 --body-file - <<EOF\n$(${QA_MERGE})\nEOF`,
  ],
  [
    "a command substitution in a double-quoted here-string",
    `gh issue comment 5 --body-file - <<< "$(${QA_MERGE})"`,
  ],
  // A real merge after, or beside, a gh body command.
  [
    "a real merge after a gh heredoc ends",
    `gh issue comment 5 --body-file - <<'EOF'\nnote\nEOF\n${QA_MERGE}`,
  ],
  ["a gh body backgrounded before a merge", `gh issue comment 5 --body-file x.md & ${QA_MERGE}`],
  [
    "a gh body heredoc with a runner on the same line",
    `gh issue comment 5 --body-file - <<'EOF'; bash x.sh\n${QA_MERGE}\nEOF`,
  ],
  ["an echo through gh into bash", `echo '${QA_MERGE}' | gh issue comment 5 --body-file - | bash`],
  [
    "a gh body round-trip into command bash",
    `echo '${QA_MERGE}' | gh issue comment 5 --body-file - && gh issue view 5 --comments | tail -1 | command bash`,
  ],
  [
    "a gh body round-trip into a quoted 'bash'",
    `echo '${QA_MERGE}' | gh issue comment 5 --body-file - && gh issue view 5 --comments | tail -1 | 'bash'`,
  ],
  [
    "a gh body round-trip into python os.system",
    `echo '${QA_MERGE}' | gh issue comment 5 --body-file - && gh issue view 5 --comments | tail -1 | python3 -c "import os,sys;os.system(sys.stdin.read())"`,
  ],
  [
    "a gh body round-trip into fish",
    `echo '${QA_MERGE}' | gh issue comment 5 --body-file - && gh issue view 5 --comments | tail -1 | fish`,
  ],
  [
    "tee into gh, writing a file",
    `echo '${QA_MERGE}' | tee x.sh | gh issue comment 5 --body-file -`,
  ],
  // Commands gh itself runs (browser, editor).
  [
    "GH_BROWSER with gh issue comment --web",
    `GH_BROWSER='sh -c "${QA_MERGE}"' gh issue comment 5 --web`,
  ],
  [
    "GH_EDITOR with gh issue comment --editor",
    `GH_EDITOR='sh -c "${QA_MERGE}"' gh issue comment 5 --editor`,
  ],
  ["BROWSER with gh pr create --web", `BROWSER="sh -c '${QA_MERGE}'" gh pr create --web`],
  // Lexer edge cases: comments, arithmetic, parameter expansion, $'...'.
  ["an apostrophe in a # comment", `echo hi # don't\n${QA_MERGE} # '`],
  ["an apostrophe in a comment, push", `echo hi # don't\n${QA_PUSH} # '`],
  [
    "an apostrophe in a comment on a gh body line",
    `gh pr comment 5 --body-file x.md # don't\n${QA_MERGE} # '`,
  ],
  ["a ;# comment before a merge", `gh issue comment 5 --body-file x.md;# it's\n${QA_MERGE}`],
  ["arithmetic << before a merge", `echo $((1<<2))\n${QA_MERGE}\n2`],
  ["arithmetic << before a push", `echo $((1<<2))\n${QA_PUSH}\n2`],
  ["a << inside a # comment", `echo hi # <<X\n${QA_MERGE}\nX`],
  ["an escaped quote in $'...'", `echo $'it\\'s'\n${QA_MERGE}\necho '\n'`],
  [
    "${x#pre} piped into gh, then a merge",
    `echo \${x#pre} | gh issue comment 5 --body-file -\n${QA_MERGE}`,
  ],
  [
    "$[1<<2] in an echo piped into gh",
    `echo $[1<<2] | gh issue comment 5 --body-file -\n${QA_MERGE}\n2]`,
  ],
  ["$[1<<2] in a gh body argument", `gh pr comment 5 --body-file x.md -t $[1<<2]\n${QA_MERGE}\n2]`],
  [
    "${x:-<<X} in a gh body argument",
    `gh pr comment 5 --body-file x.md \${x:-<<X}\n${QA_MERGE}\nX}`,
  ],
  [
    "${x:-<<X} hiding a push to main",
    `gh pr comment 5 --body-file x.md \${x:-<<X}\n${QA_PUSH}\nX}`,
  ],
];

describe("riel#771 must-block forms (AC-5)", () => {
  it("ports all 68 rows", () => {
    expect(RIEL_MUST_BLOCK).toHaveLength(68);
  });

  const mb = RIEL_MUST_BLOCK.map(
    ([label, command], i) =>
      [`TC-MB-${String(i + 1).padStart(2, "0")}: ${label}`, command] as const,
  );
  cases(mb.map(([id, command]): Case => [`${id} (base main)`, command, ENV_B, 2]));
  cases(mb.map(([id, command]): Case => [`${id} (stub defaults)`, command, ENV_0, 2]));

  cases([
    ["TC-RP-01: rule 2, a single-quoted invalid subject", "git commit -m 'bad subject'", ENV_0, 2],
    ["TC-RP-02: rule 2, an empty first -m", "git commit -m '' -m 'bad subject'", ENV_0, 2],
    [
      // riel blocks this through its local rule-2 patch (D-04). Upstream rule
      // 2 does not read a commit inside a substitution, before or after #339,
      // and rule 2 is out of scope here (D-02): pinned so a change is seen.
      "TC-RP-03: a commit inside an echo substitution (known rule-2 gap, unchanged)",
      "echo $(git commit -m 'bad subject')",
      ENV_0,
      0,
    ],
    ["TC-RP-04: rule 3, a single-quoted --body", "gh pr create --title x --body 'multi'", ENV_0, 2],
    [
      "TC-RP-05: rule 3 after an apostrophe in a comment",
      `echo x # it's\ngh pr comment 5 --body "x" #'`,
      ENV_0,
      2,
    ],
  ]);
});

describe("issue #339 / real pushes (AC-6)", () => {
  cases([
    ["TC-A6-01: issue row 6", QA_PUSH, ENV_0, 2],
    ["TC-A6-02: issue row 8", `git push -u origin ${F} && ${QA_PUSH}`, ENV_0, 2],
    ["TC-A6-03: HEAD:refs/heads/main", pushTo("HEAD:refs/heads/main"), ENV_0, 2],
    ["TC-A6-04: a feature:main refspec", pushTo(`${F}:main`), ENV_0, 2],
    ["TC-A6-05: a force push", "git push --force origin " + "main", ENV_0, 2],
    ["TC-A6-06: a push inside a substitution", `echo $(${QA_PUSH})`, ENV_0, 2],
    ["TC-A6-07: bash -c", `bash -c "${QA_PUSH}"`, ENV_0, 2],
    ["TC-A6-08: a quoted heredoc fed to bash", `bash <<'EOF'\n${QA_PUSH}\nEOF`, ENV_0, 2],
    ["TC-A6-P1: a branch that starts with main", pushTo("main-fix"), ENV_0, 0],
    ["TC-A6-P2: a feature push", `git push -u origin ${F}`, ENV_0, 0],
  ]);
});

describe("issue #339 / hook contract", () => {
  it("TC-CT-01: a block exits 2 with a BLOCKED line on stderr", () => {
    for (const command of [QA_PUSH, `bash -c '${QA_PUSH}'`]) {
      const r = runHook(command);
      expect(r.status, command).toBe(2);
      expect(r.stderr, command).toMatch(/^BLOCKED by dev-tasks git-guard/);
    }
  });

  it("TC-CT-02: an allowed call exits 0 with empty stderr", () => {
    const allowed: readonly (readonly [string, Env])[] = [
      [
        `${hc("we don't push here")}\ngit push -u origin ${F}\ngh pr create --base main --head ${F} --title t --body-file f`,
        ENV_0,
      ],
      [`cat > f.sh <<'EOF'\n${QA_PUSH}\nEOF`, ENV_0],
      [`gh issue comment 5 --body-file - <<'EOF'\nRun ${QA_MERGE} after review.\nEOF`, ENV_F],
    ];
    for (const [command, env] of allowed) {
      const r = runHook(command, env);
      expect(r, command).toEqual({ status: 0, stderr: "" });
    }
  });

  it("TC-CT-03: rule 3's message still names --body-file", () => {
    // Under a failing lookup rule 1 fails closed on the merge text first, so
    // the base resolves to a non-default branch here to reach rule 3.
    const r = runHook(`gh issue comment 5 --body "line1\nline2 ${QA_MERGE}"`, ENV_X);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--body-file");
  });

  it("TC-CT-05: fails open on a payload without a command or malformed JSON", () => {
    for (const payload of ["{}", '{"tool_input":{}}', "not json", ""]) {
      expect(runPayload(payload).status, payload).toBe(0);
    }
  });
});

describe("issue #339 / edge cases", () => {
  describe("heredoc variants", () => {
    cases([
      [
        "TC-EC-01: <<-'EOF' with tab-indented lines (D-12)",
        `cat <<-'EOF' > f.md\n\t${QA_PUSH}\n\tEOF`,
        ENV_0,
        0,
      ],
      [
        "TC-EC-02: two heredocs on one line stay strict (D-12)",
        `cat <<'A' > a.md; cat <<'B' > b.md\n${QA_PUSH}\nA\n${QA_MERGE}\nB`,
        ENV_F,
        2,
      ],
      ["TC-EC-03: a heredoc that never closes", `cat <<'EOF' > f.md\n${QA_PUSH}`, ENV_0, 2],
      ["TC-EC-04: an unquoted delimiter (D-10)", `cat <<EOF > f.md\n${QA_PUSH}\nEOF`, ENV_0, 2],
      [
        "TC-EC-05: only an exact delimiter line closes",
        `cat > f.md <<'EOF'\nEOF inside text\n${QA_PUSH}\nEOF`,
        ENV_0,
        0,
      ],
      [
        "TC-EC-06: an indented look-alike does not close",
        `cat > f.md <<'EOF'\n${QA_PUSH}\n EOF\nEOF`,
        ENV_0,
        0,
      ],
      [
        "TC-EC-07: a closer with a trailing space",
        `cat > f.md <<'EOF'\n${QA_PUSH}\nEOF \n`,
        ENV_0,
        2,
      ],
      [
        "TC-EC-08: a delimiter that is not a plain identifier",
        `cat > f.md <<'E-F'\n${QA_PUSH}\nE-F`,
        ENV_0,
        2,
      ],
      ["TC-EC-09: a backslash-quoted delimiter", `cat > f <<\\EOF\n${QA_PUSH}\nEOF`, ENV_0, 2],
      ["TC-EC-10: a space before the delimiter", `cat > f << 'EOF'\n${QA_PUSH}\nEOF`, ENV_0, 0],
      [
        "TC-EC-11: CRLF line endings (unchanged)",
        `cat > f <<'EOF'\r\n${QA_PUSH}\r\nEOF\r\n`,
        ENV_0,
        0,
      ],
    ]);
  });

  describe("text that runs on or around a heredoc line", () => {
    cases([
      ["TC-EC-12: a push on the opener line", `cat > f <<'EOF' && ${QA_PUSH}\nbody\nEOF`, ENV_0, 2],
      [
        "TC-EC-13: a push after ; on the opener line",
        `cat <<'EOF' > f; ${QA_PUSH}\nbody\nEOF`,
        ENV_0,
        2,
      ],
      ["TC-EC-14: an opener inside quotes", `printf '%s' "<<'EOF'"\n${QA_PUSH}\nEOF`, ENV_0, 2],
      ["TC-EC-15: an opener inside a comment", `echo hi # <<'EOF'\n${QA_PUSH}\nEOF`, ENV_0, 2],
      [
        "TC-EC-16: an opener inside a commit message",
        `git commit -m "fix: x <<'EOF'"\n${QA_PUSH}\nEOF`,
        ENV_0,
        2,
      ],
      ["TC-EC-17: an unquoted opener inside quotes", `echo 'a <<EOF' && ${QA_PUSH}`, ENV_0, 2],
      [
        "TC-EC-18: an apostrophe in a comment, then a heredoc, then a push",
        `echo hi # don't\ncat > f <<'EOF'\nx\nEOF\n${QA_PUSH}`,
        ENV_0,
        2,
      ],
      [
        "TC-EC-19: a continuation after the closer",
        `cat > f <<'EOF'\nx\nEOF\necho y \\\n&& ${QA_PUSH}`,
        ENV_0,
        2,
      ],
      [
        "TC-EC-20: strict mode reads heredoc bodies (accepted over-block, D-14)",
        `cd x && cat > f.sh <<'EOF'\n${QA_PUSH}\nEOF`,
        ENV_0,
        2,
      ],
      [
        "TC-EC-21: a trigger in single-quoted text (accepted over-block, D-13)",
        `printf '%s' 'use $(x) and ${QA_PUSH}' > f`,
        ENV_0,
        2,
      ],
      ["TC-EC-22: an assignment prefix", `X=1 printf '%s' '${QA_PUSH}' > f`, ENV_0, 2],
      [
        "TC-EC-23: a here-string (accepted over-block, D-10)",
        `git push origin ${F} <<< 'main'`,
        ENV_0,
        2,
      ],
    ]);
  });

  describe("text piped into a shell", () => {
    cases([
      ["TC-EC-24: a cat heredoc piped into bash", `cat <<'EOF' | bash\n${QA_PUSH}\nEOF`, ENV_0, 2],
      ["TC-EC-25: printf piped into sh", `printf '%s' '${QA_PUSH}' | sh`, ENV_0, 2],
      ["TC-EC-26: echo piped into source", `echo '${QA_PUSH}' | source /dev/stdin`, ENV_0, 2],
    ]);
  });

  describe("text that git or gh could run", () => {
    // Implementation tightening under "fail toward strict": text fed to git or
    // gh is relaxed only when the subcommand is a built-in that reads it as
    // data (`git commit`, `gh issue`, `gh pr`), since an alias cannot shadow
    // a built-in. Hook files and `!` aliases keep the command strict.
    cases([
      [
        "TC-X-01: text piped into a git ! alias",
        `echo '${QA_MERGE}' | git -c alias.x='!sh' x`,
        ENV_B,
        2,
      ],
      ["TC-X-02: a heredoc fed to a git alias", `git x <<'EOF'\n${QA_PUSH}\nEOF`, ENV_0, 2],
      ["TC-X-03: a heredoc fed to a gh alias", `gh x <<'EOF'\n${QA_PUSH}\nEOF`, ENV_0, 2],
      [
        "TC-X-04: a heredoc written to a git hook",
        `cat > .git/hooks/pre-push <<'EOF'\n${QA_PUSH}\nEOF`,
        ENV_0,
        2,
      ],
      [
        "TC-X-05: a heredoc written to a husky hook",
        `cat > .husky/pre-commit <<'EOF'\n${QA_PUSH}\nEOF`,
        ENV_0,
        2,
      ],
      ["TC-X-06: an ANSI-C string", `echo $'${QA_PUSH}' > f`, ENV_0, 2],
      ["TC-X-07: a comment keeps the command strict", `echo '${QA_PUSH}' > f # note`, ENV_0, 2],
      [
        "TC-X-08: a runner word in text keeps it strict",
        `echo '${QA_PUSH} via bash' > f`,
        ENV_0,
        2,
      ],
      ["TC-X-09: a heredoc fed to git commit -F -", `${hc(QA_PUSH)}`, ENV_0, 0],
      [
        "TC-X-10: a fd redirect keeps a segment whole",
        `git push -u origin ${F} 2>&1\ngh pr create --base main --body-file f`,
        ENV_0,
        0,
      ],
    ]);
  });

  describe("tags (rule 4 uses the executed view, D-02)", () => {
    cases([
      [
        "TC-T-01: tag commands in a heredoc body",
        `cat > notes.md <<'EOF'\ngit tag v1.0.0\ngit push origin v1.0.0\ngh release create v1.0.0\nEOF`,
        ENV_0,
        0,
      ],
      ["TC-T-02: a tag delete in printf text", `printf '%s' 'git tag -d v1.2.3' > f`, ENV_0, 0],
      ["TC-T-03: --tags in echo text", `echo "then git push --tags"`, ENV_0, 0],
      ["TC-T-N1: a tag inside a substitution", `echo $(sh -c 'git tag v1.0.0')`, ENV_0, 2],
      [
        "TC-T-N2: a tag after the heredoc closes",
        `cat > n.md <<'EOF'\nx\nEOF\ngit tag v1.0.0`,
        ENV_0,
        2,
      ],
      ["TC-T-N3: a tag push after an echo", "echo x && git push --tags", ENV_0, 2],
      [
        "TC-T-N4: a tag heredoc piped into bash",
        `cat <<'EOF' | bash\ngit tag v1.0.0\nEOF`,
        ENV_0,
        2,
      ],
      ["TC-T-N5: gh release create", "gh release create v1.0.0 --notes-file n.md", ENV_0, 2],
      ["TC-T-N6: a tag after a printf", "printf 'x' > f && git tag v1.0.0", ENV_0, 2],
    ]);
  });

  describe("rules 2 and 3 are unchanged (D-02)", () => {
    cases([
      [
        "TC-R-01: git arguments are never blanked",
        "printf 'x' > f && git commit -m 'bad subject'",
        ENV_0,
        2,
      ],
      [
        "TC-R-02: rule 3 in an allow-listed chain",
        'echo x && gh pr comment 5 --body "a\nb"',
        ENV_0,
        2,
      ],
      [
        "TC-R-03: rule 2 reads heredoc text (accepted over-block, D-02)",
        `cat > f <<'EOF'\ngit commit -m "bad subject"\nEOF`,
        ENV_0,
        2,
      ],
      [
        "TC-R-04: a quoted commit in printf text (unchanged)",
        `printf '%s' 'git commit -m "bad subject"' > f`,
        ENV_0,
        0,
      ],
    ]);
  });
});

// --- property cases (test plan section 7) ------------------------------------

const PROPERTY_TIMEOUT = 120_000;
const SEED = Number(process.env.GIT_GUARD_FUZZ_SEED ?? 0x339);
const RUNS = Number(process.env.GIT_GUARD_FUZZ_RUNS ?? 150);

interface Item {
  text: string;
  /** Ends with a heredoc closer, so the next item must start a new line. */
  heredoc: boolean;
}

/** Allow-listed noise: no strictness trigger, nothing that runs. */
const NOISE: readonly Item[] = [
  { text: hc("we don't push main"), heredoc: true },
  { text: hc('say "hi to main'), heredoc: true },
  { text: "cat > f.md <<'EOF'\nthe owner's main notes\nEOF", heredoc: true },
  { text: "echo main", heredoc: false },
  { text: `printf '%s' "--base main" > f`, heredoc: false },
  { text: "gh pr create --base main --title t --body-file f", heredoc: false },
  { text: `git push -u origin ${F}`, heredoc: false },
];

const PRIMITIVES = [
  QA_PUSH,
  pushTo("HEAD:refs/heads/main"),
  pushTo(`${F}:main`),
  QA_MERGE,
  "git tag v1.0.0",
  "git push --tags",
];

const SEPARATORS = ["\n", " && ", "; ", " || "];

/** Text-only placements of a primitive: a quoted heredoc body or quoted printf/echo text. */
const TEXT_FORMS: readonly ((p: string) => Item)[] = [
  (p) => ({ text: `cat > n.md <<'EOF'\n${p}\nEOF`, heredoc: true }),
  (p) => ({ text: `gh issue comment 5 --body-file - <<"EOF"\n${p}\nEOF`, heredoc: true }),
  (p) => ({ text: `printf '%s\\n' '${p}' > n.md`, heredoc: false }),
  (p) => ({ text: `echo "${p}" >> n.md`, heredoc: false }),
];

function join(items: readonly Item[], rand: () => number): string {
  let out = "";
  items.forEach((item, i) => {
    if (i > 0) out += (items[i - 1] as Item).heredoc ? "\n" : pick(rand, SEPARATORS);
    out += item.text;
  });
  return out;
}

function noise(rand: () => number): Item[] {
  return Array.from({ length: 1 + Math.floor(rand() * 4) }, () => pick(rand, NOISE));
}

describe("issue #339 / property cases", () => {
  it(
    "P-339-01: a must-block primitive in allow-listed noise is always blocked",
    () => {
      const rand = mulberry32(SEED);
      for (let index = 0; index < RUNS; index++) {
        const items = noise(rand);
        const at = Math.floor(rand() * (items.length + 1));
        items.splice(at, 0, { text: pick(rand, PRIMITIVES), heredoc: false });
        const command = join(items, rand);
        expect(runHook(command, ENV_B).status, JSON.stringify({ seed: SEED, index, command })).toBe(
          2,
        );
      }
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "P-339-02: a primitive that only appears in text is allowed",
    () => {
      const rand = mulberry32(SEED + 2);
      for (let index = 0; index < RUNS; index++) {
        const items = noise(rand);
        const at = Math.floor(rand() * (items.length + 1));
        items.splice(at, 0, pick(rand, TEXT_FORMS)(pick(rand, PRIMITIVES)));
        const command = join(items, rand);
        expect(runHook(command, ENV_F).status, JSON.stringify({ seed: SEED, index, command })).toBe(
          0,
        );
      }
    },
    PROPERTY_TIMEOUT,
  );
});

function pick<T>(rand: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)] as T;
}

/** Small seeded PRNG so every property run is deterministic and replayable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
