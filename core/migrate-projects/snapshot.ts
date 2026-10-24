/**
 * The read-only snapshot `--plan` builds and `--apply` will compare (spec
 * §5, §9, §12; §16a A-52, A-72, A-74 to A-76, A-88, A-91).
 *
 * Every GitHub read goes through the injected `GhRunner` and every local
 * read through the injected `LocalReader`. The order is fixed: the auth
 * check first, and nothing else is read when it fails (D-96). Lists are
 * read with `gh api --paginate` and REST numeric ids, never under a fixed
 * `--limit` cap, so a large repository is never silently truncated.
 *
 * The hash is SHA-256 over a normalized form: chosen fields only (no
 * timestamps or counters), every array sorted, object keys sorted. Two
 * reads of an unchanged repository hash the same whatever order GitHub
 * returns things in.
 */
import { createHash } from "node:crypto";
import { ROADMAP_FILE } from "../checks/roadmap.js";
import { PRIORITY_CRITICAL } from "./conventions.js";
import { issueKind } from "./classify.js";
import { firstLine, GhNotFoundError, paginatedItems, type GhRunner } from "./gh.js";
import type { LocalReader } from "./local-reader.js";

export interface SnapshotLabel {
  name: string;
  description: string;
  color: string;
}

export interface SnapshotIssue {
  /** REST numeric id, the one `sub_issue_id` and `issue_id` take (A-74). */
  id: number;
  number: number;
  title: string;
  /** `""` for an empty body. Classification only: never written to the plan file (spec §12). */
  body: string;
  labels: string[];
  milestone: string | null;
  state: "open" | "closed";
  /** The parent's number, `null` for none; absent when not read (only stories and tracking issues are). */
  parent?: number | null;
  /** Sub-issue numbers; read for tracking issues only. */
  subIssues?: number[];
  /** What this issue blocks; read for `priority: critical` issues only (A-72). */
  blocking?: number[];
}

export interface SnapshotPrdFile {
  /** `<name>` from `docs/requirements/prd-<name>.md`. */
  name: string;
  /** The first `# ` heading's text, or `null`. */
  h1: string | null;
}

export interface SnapshotStateFile {
  path: string;
  content: string;
}

export interface MigrationSnapshot {
  repo: string;
  labels: SnapshotLabel[];
  openIssues: SnapshotIssue[];
  /** Closed tracking issues, found by title-prefix search (A-91); never a full scan. */
  closedTrackingIssues: SnapshotIssue[];
  /** `false` when the search hit GitHub's 1,000-result window. */
  closedSearchComplete: boolean;
  /** `docs/roadmap.md`'s text, or `null` when absent. */
  roadmap: string | null;
  prdFiles: SnapshotPrdFile[];
  /** Active `workstream/planner-state-*.md` files; `workstream/archive/` is never read. */
  stateFiles: SnapshotStateFile[];
}

export type SnapshotErrorKind = "gh-missing" | "auth" | "repo-view" | "repo-mismatch" | "read";

export class SnapshotError extends Error {
  readonly kind: SnapshotErrorKind;
  constructor(kind: SnapshotErrorKind, message: string) {
    super(message);
    this.name = "SnapshotError";
    this.kind = kind;
  }
}

export const AUTH_HINT = "run `gh auth login` and try again";

export interface ReadSnapshotOptions {
  runner: GhRunner;
  reader: LocalReader;
  /** `--repo`; must name the working tree's repository (A-52). */
  repo?: string;
}

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function call(runner: GhRunner, args: readonly string[]) {
  try {
    return await runner(args);
  } catch (err) {
    if (err instanceof GhNotFoundError) {
      throw new SnapshotError(
        "gh-missing",
        `gh is not installed or not on PATH; install it, then ${AUTH_HINT}`,
      );
    }
    throw err;
  }
}

async function readJson(runner: GhRunner, args: readonly string[]): Promise<unknown[]> {
  const r = await call(runner, args);
  if (r.exitCode !== 0) {
    throw new SnapshotError(
      "read",
      `gh ${args.join(" ")} failed: ${firstLine(r.stderr) || `exit ${r.exitCode}`}`,
    );
  }
  try {
    return paginatedItems(r.stdout);
  } catch (err) {
    throw new SnapshotError(
      "read",
      `gh ${args.join(" ")} returned unreadable JSON: ${(err as Error).message}`,
    );
  }
}

interface RestIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string } | string>;
  milestone: { title: string } | null;
  pull_request?: unknown;
}

function isRestIssue(v: unknown): v is RestIssue {
  const o = v as Partial<RestIssue> | null;
  return (
    typeof o === "object" &&
    o !== null &&
    typeof o.number === "number" &&
    typeof o.id === "number" &&
    typeof o.title === "string"
  );
}

function toIssue(raw: unknown, where: string): SnapshotIssue {
  if (!isRestIssue(raw)) throw new SnapshotError("read", `unexpected issue shape from ${where}`);
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    labels: (raw.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)),
    milestone: raw.milestone?.title ?? null,
    state: raw.state === "closed" ? "closed" : "open",
  };
}

function numbersOf(items: unknown[], where: string): number[] {
  return items.map((i) => toIssue(i, where).number);
}

export async function readSnapshot(options: ReadSnapshotOptions): Promise<MigrationSnapshot> {
  const { runner, reader } = options;

  // D-96, A-88: auth first; nothing else is read when it fails.
  const auth = await call(runner, ["auth", "status", "--hostname", "github.com"]);
  if (auth.exitCode !== 0) {
    throw new SnapshotError(
      "auth",
      `gh is not authenticated to github.com (${firstLine(auth.stderr) || `exit ${auth.exitCode}`}); ${AUTH_HINT}`,
    );
  }

  // A-52: the working tree's repository; `--repo` may only confirm it.
  const view = await call(runner, ["repo", "view", "--json", "nameWithOwner"]);
  let workingTree: string | undefined;
  if (view.exitCode === 0) {
    try {
      workingTree = (JSON.parse(view.stdout) as { nameWithOwner?: string }).nameWithOwner;
    } catch {
      workingTree = undefined;
    }
  }
  if (workingTree === undefined || !REPO_PATTERN.test(workingTree)) {
    throw new SnapshotError(
      "repo-view",
      `gh repo view failed (${firstLine(view.stderr) || "no repository"}); run inside a clone of the repository to migrate`,
    );
  }
  if (options.repo !== undefined && options.repo.toLowerCase() !== workingTree.toLowerCase()) {
    throw new SnapshotError(
      "repo-mismatch",
      `--repo ${options.repo} is not this working tree's repository (${workingTree}); the roadmap and state files are read from the working tree, so run inside a clone of ${options.repo}`,
    );
  }
  const repo = workingTree;
  const r = `repos/${repo}`;

  // Local files (A-52), read after auth so a failed check reads nothing.
  const roadmap = reader.readText(ROADMAP_FILE) ?? null;
  const prdFiles = reader
    .listFiles("docs/requirements")
    .filter((f) => /^prd-.+\.md$/.test(f))
    .map((f) => {
      const text = reader.readText(`docs/requirements/${f}`) ?? "";
      const h1 = text.split(/\r?\n/).find((l) => l.startsWith("# "));
      return {
        name: f.slice("prd-".length, -".md".length),
        h1: h1 === undefined ? null : h1.slice(2).trim(),
      };
    });
  const stateFiles = reader
    .listFiles("workstream")
    .filter((f) => /^planner-state-.+\.md$/.test(f))
    .map((f) => ({ path: `workstream/${f}`, content: reader.readText(`workstream/${f}`) ?? "" }));

  const labels = (await readJson(runner, ["api", "--paginate", `${r}/labels?per_page=100`])).map(
    (l) => {
      const o = l as Partial<SnapshotLabel>;
      return { name: String(o.name), description: o.description ?? "", color: o.color ?? "" };
    },
  );

  const openIssues = (
    await readJson(runner, ["api", "--paginate", `${r}/issues?state=open&per_page=100`])
  )
    .filter((i) => (i as RestIssue).pull_request === undefined)
    .map((i) => toIssue(i, "the open-issue list"));

  // A-91: closed tracking issues by title search, then the exact prefix rule.
  const q = encodeURIComponent(`repo:${repo} is:issue is:closed PRD in:title`);
  // Search pages are objects (`{ total_count, items }`), kept whole by `paginatedItems`.
  const pages = await readJson(runner, ["api", "--paginate", `search/issues?q=${q}&per_page=100`]);
  const total = Math.max(
    0,
    ...pages.map((p) => Number((p as { total_count?: number }).total_count ?? 0)),
  );
  const prdTitles = new Map(
    prdFiles.filter((p) => p.h1 !== null).map((p) => [p.name, p.h1 as string]),
  );
  const closedTrackingIssues = pages
    .flatMap((p) => (p as { items?: unknown[] }).items ?? [])
    .filter((i) => (i as RestIssue).pull_request === undefined)
    .map((i) => toIssue(i, "the closed-issue search"))
    .filter((i) => i.state === "closed" && issueKind(i, prdTitles).kind === "tracking");

  // Per-issue reads: sub-issues and parent for tracking issues (open and
  // closed), parent for stories (A-76), what critical issues block (A-72).
  for (const issue of [...openIssues, ...closedTrackingIssues]) {
    const kind = issueKind(issue, prdTitles).kind;
    if (kind === "tracking") {
      issue.subIssues = numbersOf(
        await readJson(runner, [
          "api",
          "--paginate",
          `${r}/issues/${issue.number}/sub_issues?per_page=100`,
        ]),
        `issue #${issue.number}'s sub-issues`,
      );
    }
    if (kind === "tracking" || kind === "story") {
      issue.parent = await readParent(runner, `${r}/issues/${issue.number}/parent`);
    }
    if (issue.state === "open" && issue.labels.includes(PRIORITY_CRITICAL)) {
      issue.blocking = numbersOf(
        await readJson(runner, [
          "api",
          "--paginate",
          `${r}/issues/${issue.number}/dependencies/blocking?per_page=100`,
        ]),
        `issue #${issue.number}'s blocking list`,
      );
    }
  }

  return {
    repo,
    labels,
    openIssues,
    closedTrackingIssues,
    closedSearchComplete: total <= 1000,
    roadmap,
    prdFiles,
    stateFiles,
  };
}

async function readParent(runner: GhRunner, endpoint: string): Promise<number | null> {
  const args = ["api", endpoint];
  const res = await call(runner, args);
  if (res.exitCode !== 0) {
    if (/HTTP 404/.test(res.stderr)) return null;
    throw new SnapshotError("read", `gh ${args.join(" ")} failed: ${firstLine(res.stderr)}`);
  }
  try {
    return toIssue(JSON.parse(res.stdout), endpoint).number;
  } catch (err) {
    if (err instanceof SnapshotError) throw err;
    throw new SnapshotError("read", `gh ${args.join(" ")} returned unreadable JSON`);
  }
}

// --- hash ---------------------------------------------------------------------

function sortIssue(i: SnapshotIssue): SnapshotIssue {
  return {
    ...i,
    labels: [...i.labels].sort(),
    ...(i.subIssues ? { subIssues: [...i.subIssues].sort((a, b) => a - b) } : {}),
    ...(i.blocking ? { blocking: [...i.blocking].sort((a, b) => a - b) } : {}),
  };
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The snapshot with every array in a canonical order. */
export function normalizeSnapshot(s: MigrationSnapshot): MigrationSnapshot {
  return {
    repo: s.repo.toLowerCase(),
    labels: [...s.labels].sort((a, b) => byString(a.name, b.name)),
    openIssues: s.openIssues.map(sortIssue).sort((a, b) => a.number - b.number),
    closedTrackingIssues: s.closedTrackingIssues.map(sortIssue).sort((a, b) => a.number - b.number),
    closedSearchComplete: s.closedSearchComplete,
    roadmap: s.roadmap,
    prdFiles: [...s.prdFiles].sort((a, b) => byString(a.name, b.name)),
    stateFiles: [...s.stateFiles].sort((a, b) => byString(a.path, b.path)),
  };
}

/** JSON with object keys sorted at every level. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => byString(a, b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** SHA-256 hex over the sorted, normalized JSON form (spec §12). */
export function snapshotHash(s: MigrationSnapshot): string {
  return createHash("sha256")
    .update(stableStringify(normalizeSnapshot(s)))
    .digest("hex");
}
