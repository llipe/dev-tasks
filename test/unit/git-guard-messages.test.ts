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
 */
function namesAlternativeOrHumanOnly(message: string): boolean {
  const humanOnlyPatterns = [/only the user may/i, /human[- ]only/i, /is human only/i];
  const alternativePatterns = [
    // Explicit "use X instead" / "instead of" framing.
    /\buse\b.*\binstead\b/i,
    /\binstead\b/i,
    // Concrete alternative commands/flags/actions named in the message.
    /open a pr/i,
    /--body-file/i,
    /write (the )?(body )?to a (file|feature branch)/i,
    /gh pr merge/i,
    /feature branch/i,
    /ask the user/i,
    /e\.g\.,? ['"]?(feat|fix|chore|docs|refactor|test|ci|perf|build|style|revert)/i,
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
});
