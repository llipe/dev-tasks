/**
 * In-memory GitHub model for the migrate-projects tests (D-90).
 *
 * It answers the `gh` reads `--plan` issues from its own state, the way
 * GitHub would: paginated REST lists, `HTTP 404` for an issue with no
 * parent, search results for closed issues. Pagination is emulated so a
 * list longer than one page arrives as several concatenated JSON values,
 * which is what `gh api --paginate` prints for objects (and what older
 * `gh` versions print for arrays).
 *
 * Writes are not modelled here: `--plan` only reads, `model-apply.ts`
 * applies a plan's rows to a model on the test side, and `fake-github-writes.ts`
 * answers the write argv `--apply` issues (S-015). Any argv this model does
 * not recognise answers exit 1 with `fake gh: unhandled argv`, so a new
 * read cannot pass silently.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ModelLabel {
  name: string;
  description: string;
  color: string;
}

export interface ModelIssue {
  id: number;
  number: number;
  state: "open" | "closed";
  title: string;
  body: string | null;
  labels: string[];
  milestone: string | null;
  parent: number | null;
  /** Issue numbers this issue blocks (its `dependencies/blocking` list). */
  blocking: number[];
  pullRequest?: boolean;
}

export interface RepoModel {
  repo: string;
  labels: ModelLabel[];
  issues: ModelIssue[];
  /** Repository-relative path to file content, served by the fake `LocalReader`. */
  files: Record<string, string>;
  /** Issue comments by issue number; absent means none. */
  comments?: Record<string, ModelComment[]>;
}

export interface ModelComment {
  id: number;
  body: string;
}

export interface GhResultLike {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface FakeOptions {
  /** Items per page for paginated lists (default 100). */
  pageSize?: number;
  /** Answer `auth status` with exit 1. */
  authFails?: boolean;
  /** Answer `repo view` with exit 1. */
  repoViewFails?: boolean;
  /** The repository `repo view` reports for the working tree (default: the model's). */
  workingTreeRepo?: string;
  /** Search reports `total_count` above GitHub's 1,000-result window. */
  searchIncomplete?: boolean;
}

const FIXTURES = resolve(import.meta.dirname, "../../../fixtures/migrate-projects");

export function loadModel(name: string): RepoModel {
  return JSON.parse(readFileSync(resolve(FIXTURES, name, "repo.json"), "utf-8")) as RepoModel;
}

/** A deep copy, so a test can mutate a fixture without touching another test's. */
export function cloneModel(model: RepoModel): RepoModel {
  return JSON.parse(JSON.stringify(model)) as RepoModel;
}

function restIssue(model: RepoModel, issue: ModelIssue): Record<string, unknown> {
  return {
    id: issue.id,
    node_id: `I_node${issue.id}`,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels.map((name) => ({ id: name.length, name, color: "ededed" })),
    milestone: issue.milestone === null ? null : { title: issue.milestone, number: 1 },
    comments: 3,
    updated_at: "2026-10-23T00:00:00Z",
    created_at: "2026-10-01T00:00:00Z",
    repository_url: `https://api.github.com/repos/${model.repo}`,
    ...(issue.pullRequest === true ? { pull_request: { url: "x" } } : {}),
  };
}

function pages<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const ok = (stdout: string): GhResultLike => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string, stdout = ""): GhResultLike => ({ stdout, stderr, exitCode: 1 });

/**
 * Answer one `gh` argv from the model. Pure: the model is never mutated by a
 * read.
 */
export function respond(
  model: RepoModel,
  argv: readonly string[],
  options: FakeOptions = {},
): GhResultLike {
  const size = options.pageSize ?? 100;
  const key = argv.join(" ");

  if (key === "auth status --hostname github.com") {
    return options.authFails === true
      ? fail("You are not logged into any GitHub hosts. To log in, run: gh auth login")
      : ok("github.com\n  ✓ Logged in to github.com account fake\n");
  }
  if (key === "repo view --json nameWithOwner") {
    if (options.repoViewFails === true) return fail("no git remotes found");
    return ok(JSON.stringify({ nameWithOwner: options.workingTreeRepo ?? model.repo }) + "\n");
  }

  if (argv[0] !== "api") return fail(`fake gh: unhandled argv: ${key}`);
  const rest = argv.slice(1);
  const paginate = rest.includes("--paginate");
  const endpoints = rest.filter((a) => !a.startsWith("-"));
  if (endpoints.length !== 1 || rest.length !== endpoints.length + (paginate ? 1 : 0)) {
    return fail(`fake gh: unhandled argv: ${key}`);
  }
  const url = new URL(`https://api.github.test/${endpoints[0]}`);
  const path = url.pathname.slice(1);
  const prefix = `repos/${model.repo}/`;
  const byNumber = new Map(model.issues.map((i) => [i.number, i]));
  const emitArray = (items: unknown[]): GhResultLike =>
    ok((paginate ? pages(items, size) : [items]).map((p) => JSON.stringify(p)).join(""));

  if (path === "search/issues") {
    const q = url.searchParams.get("q") ?? "";
    const closedOnly = q.includes("is:closed");
    const hits = model.issues.filter(
      (i) =>
        i.pullRequest !== true &&
        (!closedOnly || i.state === "closed") &&
        /prd/i.test(i.title) &&
        q.includes(`repo:${model.repo}`),
    );
    const total = options.searchIncomplete === true ? 1500 : hits.length;
    const objects = (paginate ? pages(hits, size) : [hits]).map((p) =>
      JSON.stringify({
        total_count: total,
        incomplete_results: false,
        items: p.map((i) => restIssue(model, i)),
      }),
    );
    return ok(objects.join(""));
  }

  if (!path.startsWith(prefix)) return fail(`gh: Not Found (HTTP 404)`);
  const tail = path.slice(prefix.length);

  if (tail === "labels") {
    return emitArray(
      model.labels.map((l, n) => ({
        id: n + 1,
        name: l.name,
        description: l.description,
        color: l.color,
        default: false,
      })),
    );
  }
  if (tail === "issues") {
    const state = url.searchParams.get("state") ?? "open";
    const selected = model.issues.filter((i) => state === "all" || i.state === state);
    return emitArray(selected.map((i) => restIssue(model, i)));
  }
  // Single reads `--apply` makes: an issue (for its REST id) and a comment (its body).
  const one = tail.match(/^issues\/(\d+)$/);
  if (one) {
    const issue = byNumber.get(Number(one[1]));
    if (issue === undefined) return fail("gh: Not Found (HTTP 404)");
    return ok(JSON.stringify(restIssue(model, issue)));
  }
  const oneComment = tail.match(/^issues\/comments\/(\d+)$/);
  if (oneComment) {
    for (const [n, list] of Object.entries(model.comments ?? {})) {
      const hit = list.find((x) => x.id === Number(oneComment[1]));
      if (hit !== undefined) {
        return ok(
          JSON.stringify({
            id: hit.id,
            body: hit.body,
            issue_url: `https://api.github.com/repos/${model.repo}/issues/${n}`,
          }),
        );
      }
    }
    return fail("gh: Not Found (HTTP 404)");
  }
  const c = tail.match(/^issues\/(\d+)\/comments$/);
  if (c) {
    if (!byNumber.has(Number(c[1]))) return fail("gh: Not Found (HTTP 404)");
    return emitArray(
      (model.comments?.[c[1]] ?? []).map((x) => ({
        id: x.id,
        body: x.body,
        user: { login: "someone" },
        created_at: "2026-10-01T00:00:00Z",
      })),
    );
  }
  const m = tail.match(/^issues\/(\d+)\/(sub_issues|parent|dependencies\/blocking)$/);
  if (m) {
    const issue = byNumber.get(Number(m[1]));
    if (issue === undefined) return fail("gh: Not Found (HTTP 404)");
    if (m[2] === "parent") {
      if (issue.parent === null) {
        return fail(
          "gh: No parent issue found (HTTP 404)",
          JSON.stringify({ message: "No parent issue found", status: "404" }),
        );
      }
      return ok(JSON.stringify(restIssue(model, byNumber.get(issue.parent)!)));
    }
    if (m[2] === "sub_issues") {
      return emitArray(
        model.issues.filter((i) => i.parent === issue.number).map((i) => restIssue(model, i)),
      );
    }
    return emitArray(
      issue.blocking
        .map((n) => byNumber.get(n))
        .filter((i) => i !== undefined)
        .map((i) => restIssue(model, i)),
    );
  }
  return fail(`fake gh: unhandled argv: ${key}`);
}
