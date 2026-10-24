/**
 * The write half of the fake GitHub model, for `--apply` (S-015, D-90).
 *
 * Written here from what `gh` and GitHub do with each write argv, not from
 * `apply.ts`, so "the resulting repository state is right" is checked by
 * an oracle the code under test did not write. Label names compare
 * case-insensitively, as GitHub's do (D-106). A body file is read at call
 * time, the way `gh` reads it, and must exist then.
 *
 * Recognised writes (CT-33):
 *
 * - `label create --repo=<r> --color=<hex> --description=<d> -- <name>`
 * - `label edit --repo=<r> --description=<d> -- <name>`
 * - `issue create --repo=<r> --title=<t> --label=<l> --body-file=<path>`
 * - `issue edit <n> --repo=<r> --add-label=<l>` / `--remove-label=<l>`
 * - `issue comment <n> --repo=<r> --body-file=<path>`
 * - `api -X POST repos/<r>/issues/<n>/sub_issues --field=sub_issue_id=<id>`
 * - `api -X POST repos/<r>/issues/<n>/dependencies/blocked_by --field=issue_id=<id>`
 * - `api -X PATCH repos/<r>/issues/comments/<id> --field=body=@<path>`
 *
 * Anything else answers exit 1 with `fake gh: unhandled argv`, and a call
 * that must never happen (`project`, `label delete`, `issue delete`,
 * `issue close`, a title edit) throws, failing the test where it happens.
 */
import { existsSync, readFileSync } from "node:fs";
import type { GhRunner } from "#core/migrate-projects/gh.js";
import { respond, type FakeOptions, type GhResultLike, type RepoModel } from "./fake-github.js";
import { isWrite } from "./is-write.js";

const ok = (stdout = ""): GhResultLike => ({ stdout, stderr: "", exitCode: 0 });
const fail = (stderr: string): GhResultLike => ({ stdout: "", stderr, exitCode: 1 });

/** Thrown for a call `--apply` must never make; the message names it. */
export class ForbiddenCall extends Error {}

export function forbiddenReason(argv: readonly string[]): string | null {
  const a = argv.join(" ");
  if (argv.includes("project") || /\bprojects?\b/.test(argv[0] ?? "")) return "a Project call";
  if (argv[0] === "label" && argv[1] === "delete") return "a label delete";
  if (argv[0] === "issue" && ["delete", "close", "transfer", "lock"].includes(argv[1] ?? ""))
    return `issue ${argv[1]}`;
  if (argv[0] === "issue" && argv[1] === "edit" && argv.some((x) => /^--title\b|^-t$/.test(x)))
    return "a title edit";
  if (argv.some((x) => x === "--body" || x.startsWith("--body=") || x === "-b"))
    return "an inline --body";
  if (/-X DELETE|--method=DELETE|--method DELETE/i.test(a)) return "a DELETE";
  return null;
}

/** `--name=value` → value; `undefined` when the flag is absent. Two of the same flag is refused. */
function flag(argv: readonly string[], name: string): string | undefined {
  const hits = argv.filter((x) => x.startsWith(`--${name}=`));
  if (hits.length > 1) throw new Error(`fake gh: --${name} given twice`);
  return hits[0]?.slice(name.length + 3);
}

function afterDashDash(argv: readonly string[]): string | undefined {
  const i = argv.indexOf("--");
  return i === -1 || i !== argv.length - 2 ? undefined : argv[i + 1];
}

function readBody(path: string | undefined): string | GhResultLike {
  if (path === undefined) return fail("fake gh: no body file");
  if (!existsSync(path)) return fail(`open ${path}: no such file or directory`);
  return readFileSync(path, "utf-8");
}

function repoOk(model: RepoModel, argv: readonly string[]): boolean {
  return flag(argv, "repo") === model.repo;
}

/** Apply one write argv to `model`, the way GitHub would; mutates the model. */
export function respondWrite(model: RepoModel, argv: readonly string[]): GhResultLike {
  const why = forbiddenReason(argv);
  if (why !== null) throw new ForbiddenCall(`--apply made ${why}: gh ${argv.join(" ")}`);
  const key = argv.join(" ");
  const labelOf = (name: string) =>
    model.labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  const byNumber = (n: number) => model.issues.find((i) => i.number === n);

  if (argv[0] === "label" && (argv[1] === "create" || argv[1] === "edit")) {
    const name = afterDashDash(argv);
    if (name === undefined || !repoOk(model, argv)) return fail(`fake gh: unhandled argv: ${key}`);
    const description = flag(argv, "description");
    if (description !== undefined && description.length > 100)
      return fail("HTTP 422: Validation Failed (description is too long)");
    const existing = labelOf(name);
    if (argv[1] === "create") {
      const color = flag(argv, "color");
      if (color === undefined || !/^[0-9A-Fa-f]{6}$/.test(color))
        return fail("HTTP 422: Validation Failed (color)");
      if (existing !== undefined)
        return fail('HTTP 422: Validation Failed (Label "name" already_exists)');
      model.labels.push({ name, color: color.toUpperCase(), description: description ?? "" });
      return ok(`✓ Label "${name}" created in ${model.repo}\n`);
    }
    if (existing === undefined) return fail(`HTTP 404: label ${name} not found`);
    if (description !== undefined) existing.description = description;
    return ok(`✓ Label "${existing.name}" updated in ${model.repo}\n`);
  }

  if (argv[0] === "issue" && argv[1] === "create") {
    if (!repoOk(model, argv)) return fail(`fake gh: unhandled argv: ${key}`);
    const title = flag(argv, "title");
    const label = flag(argv, "label");
    const body = readBody(flag(argv, "body-file"));
    if (typeof body !== "string") return body;
    if (title === undefined || title.length === 0) return fail("title can't be blank");
    const labels = label === undefined ? [] : label.split(",");
    const defined = labels.map(labelOf);
    if (defined.some((l) => l === undefined))
      return fail(`could not add label: '${labels[defined.indexOf(undefined)]}' not found`);
    const number = Math.max(0, ...model.issues.map((i) => i.number)) + 1;
    model.issues.push({
      id: 800000 + number,
      number,
      state: "open",
      title,
      body,
      labels: defined.map((l) => l!.name),
      milestone: null,
      parent: null,
      blocking: [],
    });
    return ok(`https://github.com/${model.repo}/issues/${number}\n`);
  }

  if (argv[0] === "issue" && (argv[1] === "edit" || argv[1] === "comment")) {
    const n = Number(argv[2]);
    if (!/^\d+$/.test(argv[2] ?? "") || !repoOk(model, argv))
      return fail(`fake gh: unhandled argv: ${key}`);
    const issue = byNumber(n);
    if (issue === undefined) return fail(`GraphQL: Could not resolve to an issue (#${n})`);
    if (argv[1] === "comment") {
      const body = readBody(flag(argv, "body-file"));
      if (typeof body !== "string") return body;
      model.comments ??= {};
      const list = (model.comments[String(n)] ??= []);
      const id = Math.max(900000, ...Object.values(model.comments).flat().map((c) => c.id)) + 1;
      list.push({ id, body });
      return ok(`https://github.com/${model.repo}/issues/${n}#issuecomment-${id}\n`);
    }
    const add = flag(argv, "add-label");
    const remove = flag(argv, "remove-label");
    if (argv.length !== 5 || (add === undefined) === (remove === undefined))
      return fail(`fake gh: unhandled argv: ${key}`);
    if (add !== undefined) {
      const l = labelOf(add);
      if (l === undefined) return fail(`'${add}' not found`);
      if (!issue.labels.some((x) => x.toLowerCase() === l.name.toLowerCase()))
        issue.labels.push(l.name);
    } else {
      issue.labels = issue.labels.filter((x) => x.toLowerCase() !== remove!.toLowerCase());
    }
    return ok(`https://github.com/${model.repo}/issues/${n}\n`);
  }

  if (argv[0] === "api" && argv[1] === "-X" && argv.length === 5) {
    const method = argv[2];
    const path = argv[3];
    const field = argv[4];
    const prefix = `repos/${model.repo}/`;
    if (!path.startsWith(prefix)) return fail("gh: Not Found (HTTP 404)");
    const tail = path.slice(prefix.length);
    const sub = tail.match(/^issues\/(\d+)\/sub_issues$/);
    const dep = tail.match(/^issues\/(\d+)\/dependencies\/blocked_by$/);
    const patch = tail.match(/^issues\/comments\/(\d+)$/);
    if (method === "POST" && sub) {
      const m = field.match(/^--field=sub_issue_id=(\d+)$/);
      const parent = byNumber(Number(sub[1]));
      const child = m ? model.issues.find((i) => i.id === Number(m[1])) : undefined;
      if (!m) return fail(`fake gh: unhandled argv: ${key}`);
      if (parent === undefined || child === undefined) return fail("gh: Not Found (HTTP 404)");
      if (child.parent !== null)
        return fail("HTTP 422: Validation Failed (sub-issue already has a parent)");
      child.parent = parent.number;
      return ok(JSON.stringify({ number: parent.number }));
    }
    if (method === "POST" && dep) {
      const m = field.match(/^--field=issue_id=(\d+)$/);
      const blocked = byNumber(Number(dep[1]));
      const blocker = m ? model.issues.find((i) => i.id === Number(m[1])) : undefined;
      if (!m) return fail(`fake gh: unhandled argv: ${key}`);
      if (blocked === undefined || blocker === undefined) return fail("gh: Not Found (HTTP 404)");
      if (blocker.blocking.includes(blocked.number))
        return fail("HTTP 422: Validation Failed (dependency already exists)");
      blocker.blocking.push(blocked.number);
      return ok(JSON.stringify({ number: blocked.number }));
    }
    if (method === "PATCH" && patch) {
      const m = field.match(/^--field=body=@(.+)$/);
      if (!m) return fail(`fake gh: unhandled argv: ${key}`);
      const body = readBody(m[1]);
      if (typeof body !== "string") return body;
      for (const list of Object.values(model.comments ?? {})) {
        const c = list.find((x) => x.id === Number(patch[1]));
        if (c !== undefined) {
          c.body = body;
          return ok(JSON.stringify({ id: c.id }));
        }
      }
      return fail("gh: Not Found (HTTP 404)");
    }
  }
  return fail(`fake gh: unhandled argv: ${key}`);
}

/** Body-file paths in an argv: `--body-file=<p>` and `--field=body=@<p>`. */
export function bodyPaths(argv: readonly string[]): string[] {
  return argv.flatMap((a) => {
    const m = a.match(/^--body-file=(.+)$/) ?? a.match(/^--field=body=@(.+)$/);
    return m ? [m[1]] : [];
  });
}

/** The argv with body-file paths replaced, so two runs compare equal. */
export function normalizeArgv(argv: readonly string[]): string[] {
  return argv.map((a) =>
    a.replace(/^--body-file=.+$/, "--body-file=<file>").replace(/^--field=body=@.+$/, "--field=body=@<file>"),
  );
}

/**
 * What an intercepted call does: `undefined` lets it through; a result
 * answers it without touching the model (a failed write); `"throw"`
 * interrupts before GitHub sees it; `"apply-then-throw"` lets GitHub apply
 * it and then interrupts, as a process killed after the request landed.
 */
export type Intercept = GhResultLike | "throw" | "apply-then-throw" | undefined;

export interface ApplyCall {
  argv: string[];
  write: boolean;
  /** Body files' content and path, read during the call. */
  bodies: Array<{ path: string; content: string }>;
}

export interface ApplyRunner {
  runner: GhRunner;
  calls: ApplyCall[];
  /** Write argv only, in order. */
  writes(): string[][];
}

export interface ApplyRunnerOptions extends FakeOptions {
  /** Called before each write with its 1-based write index; see `Intercept`. */
  onWrite?: (argv: readonly string[], index: number) => Intercept;
  /** Called before each read. */
  onRead?: (argv: readonly string[]) => Intercept;
}

/** A `GhRunner` over the model answering reads and writes, recording every call. */
export function applyRunner(model: RepoModel, options: ApplyRunnerOptions = {}): ApplyRunner {
  const calls: ApplyCall[] = [];
  let writeIndex = 0;
  const runner: GhRunner = async (args) => {
    const write = isWrite(args);
    const bodies = bodyPaths(args).map((path) => ({
      path,
      content: existsSync(path) ? readFileSync(path, "utf-8") : "<missing>",
    }));
    calls.push({ argv: [...args], write, bodies });
    const forbiddenWhy = forbiddenReason(args);
    if (forbiddenWhy !== null)
      throw new ForbiddenCall(`--apply made ${forbiddenWhy}: gh ${args.join(" ")}`);
    const intercept = write ? options.onWrite?.(args, ++writeIndex) : options.onRead?.(args);
    if (intercept === "throw") throw new Error("interrupted (test)");
    if (intercept !== undefined && intercept !== "apply-then-throw") return intercept;
    const result = write ? respondWrite(model, args) : respond(model, args, options);
    if (intercept === "apply-then-throw") throw new Error("interrupted after the write (test)");
    return result;
  };
  return { runner, calls, writes: () => calls.filter((c) => c.write).map((c) => c.argv) };
}
