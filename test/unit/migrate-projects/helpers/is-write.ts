/**
 * The read-only oracle for `--plan` (S-013 AC-6, RT-10).
 *
 * Written here, in the test, and never imported from production code, so
 * the "zero writes" property is not checked by the code it is checking.
 *
 * Read: `auth status`, `repo view`, `label list`, `issue list`,
 * `issue view`, or `api` with no `-X`/`--method` other than `GET` and no
 * field flag (`-f`, `-F`, `--field`, `--raw-field`, `--input`), any of
 * which makes `gh api` default to POST. Everything else is a write.
 */
const READ_SUBCOMMANDS = new Set([
  "auth status",
  "repo view",
  "label list",
  "issue list",
  "issue view",
]);

const FIELD_FLAGS = ["-f", "-F", "--field", "--raw-field", "--input"];

export function isWrite(argv: readonly string[]): boolean {
  if (argv.length === 0) return true;
  if (READ_SUBCOMMANDS.has(`${argv[0]} ${argv[1] ?? ""}`)) return false;
  if (argv[0] !== "api") return true;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (FIELD_FLAGS.some((f) => a === f || a.startsWith(`${f}=`))) return true;
    if (a === "-X" || a === "--method") {
      if ((argv[i + 1] ?? "").toUpperCase() !== "GET") return true;
    }
    if (a.startsWith("-X") && a.length > 2 && a.slice(2).toUpperCase() !== "GET") return true;
    if (a.startsWith("--method=") && a.slice(9).toUpperCase() !== "GET") return true;
  }
  return false;
}
