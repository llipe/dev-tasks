/**
 * Deterministic checks for git-guard block-message quality (issue #179, task 11.0).
 *
 * Task 9.0's confirmed live defect was a `block()` message that referenced a
 * `--base` flag that does not exist on `gh pr merge` — an agent, following the
 * mandate to merge, tried to route around the block instead of stopping. The
 * structural fix isn't just correcting that one message: every message this
 * script can emit through `block()` or `mcp_block()` MUST either (a) name a
 * concrete permitted alternative the agent can take instead, or (b) state
 * plainly that the action is human-only. A message that does neither invites
 * exactly the route-around behavior task 11.0 forbids.
 *
 * This test parses the actual script source for every `block "..."` /
 * `mcp_block "..."` call (including multi-line concatenated string literals)
 * and mechanically asserts each resulting message text satisfies (a) or (b).
 * It is intentionally over the raw source, not just a curated list, so a
 * future new block message added without following the contract fails this
 * test rather than slipping through silently.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const HOOK_PATH = resolve(ROOT, ".claude/hooks/git-guard.sh");
const source = readFileSync(HOOK_PATH, "utf-8");

/**
 * Extract the literal message text passed to every `block "..."` and
 * `mcp_block "..."` call site in the script.
 *
 * Messages are shell double-quoted strings that may span the call
 * expression only (git-guard.sh never wraps a message call across multiple
 * physical lines), and may contain `$variable` interpolation, which is
 * normalized away before returning (interpolated values don't affect
 * whether the surrounding prose names an alternative or states human-only).
 */
function extractBlockMessages(src: string): string[] {
  const messages: string[] = [];
  // Matches: block "...."  or  mcp_block "...."
  // Handles embedded escaped quotes (\") inside the double-quoted string.
  const callRegex = /\b(?:mcp_block|block)\s+"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(src)) !== null) {
    messages.push(match[1]);
  }
  return messages;
}

const messages = extractBlockMessages(source);

/**
 * A message satisfies the contract if it names a concrete permitted
 * alternative action, OR states plainly the action is human-only.
 *
 * Task 11.0 (round 2): the original alternativePatterns matched on bare
 * keywords ("instead" appearing anywhere, "gh pr merge" appearing anywhere)
 * with no requirement that the match sit in a genuine suggestion context.
 * That let a message pass purely because the *forbidden* command's own name
 * happened to contain "gh pr merge" (the pre-fix `--admin` message: "'gh pr
 * merge --admin' ... is not allowed for agents." names no alternative at
 * all, yet matched /gh pr merge/i against itself), or because "instead"
 * appeared in a sentence that names no concrete action ("... is not allowed
 * instead of doing the right thing."). The patterns below require the
 * suggestion language to sit near a directive verb (use/open/write/
 * create/ask) in the same sentence, or to be one of a small set of known
 * concrete-alternative phrasings, rather than matching the trigger word in
 * isolation.
 */
function namesAlternativeOrHumanOnly(message: string): boolean {
  const humanOnlyPatterns = [/only the user may/i, /human[- ]only/i, /is human only/i];
  const alternativePatterns = [
    // "Use/Open/Write/Create/Ask ... instead" — requires a directive verb
    // within the same sentence as "instead", not just the bare word
    // floating anywhere in the message (see comment above).
    /\b(?:use|open|write|create|ask)\b[^.]{0,80}\binstead\b/i,
    // Concrete alternative actions explicitly instructed (verb-led, not a
    // bare keyword/flag/command name that could equally be the forbidden
    // action itself).
    /\bwrite (the )?(body )?to a (file|feature branch)\b/i,
    /\bask the user\b/i,
    /\be\.g\.,? ['"]?(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)/i,
  ];
  return (
    humanOnlyPatterns.some((re) => re.test(message)) ||
    alternativePatterns.some((re) => re.test(message))
  );
}

describe("git-guard.sh block message quality (issue #179)", () => {
  it("finds at least one block()/mcp_block() call to check (sanity guard against a broken extractor)", () => {
    expect(messages.length).toBeGreaterThan(0);
  });

  it.each(messages.map((message, index) => ({ message, index })))(
    "message #$index names a permitted alternative or states human-only: $message",
    ({ message }) => {
      expect(namesAlternativeOrHumanOnly(message)).toBe(true);
    },
  );

  it("does not reference a nonexistent gh pr merge --base flag (the confirmed task 9.0 defect)", () => {
    for (const message of messages) {
      expect(message).not.toMatch(/--base\b/);
    }
  });

  /**
   * Regression coverage for the round-2 fix: these two synthetic messages
   * mirror the constructions verifier used to prove the pre-fix
   * `namesAlternativeOrHumanOnly()` was too loose. Neither names a real
   * permitted alternative or states the action is human-only — they must
   * both fail the check under the tightened heuristic.
   */
  describe("synthetic bad-message regressions (verifier's constructions)", () => {
    it("rejects a fake flag reference whose forbidden-command name merely contains 'gh pr merge'", () => {
      // Mirrors the pre-fix `--admin` defect: the forbidden command's own
      // name contains "gh pr merge", but no alternative or human-only
      // statement is actually given.
      const message = "'gh pr merge --target' is not allowed for agents.";
      expect(namesAlternativeOrHumanOnly(message)).toBe(false);
    });

    it("rejects a vague made-up-flag reference that uses 'instead' without naming a concrete action", () => {
      // "instead" appears, but no directive verb (use/open/write/create/ask)
      // introduces an actual alternative — it's just restating the block.
      const message =
        "'git commit --made-up-flag' is not allowed for agents instead of doing the right thing.";
      expect(namesAlternativeOrHumanOnly(message)).toBe(false);
    });
  });
});
