/**
 * CLI handler for `dt extract schema`.
 * Outputs schema extraction results in human-readable or JSON format.
 */

import { resolve } from "node:path";
import { extractSchema } from "#core/extract/schema.js";
import { renderSchemaMd } from "#core/extract/render/schema-md.js";
import { ExitCode } from "#core/exit-codes.js";

export interface ExtractSchemaOptions {
  json: boolean;
  targetDir?: string;
  dbUrl?: string;
}

/**
 * Run the extract schema command.
 * Returns exit code.
 */
export async function runExtractSchema(options: ExtractSchemaOptions): Promise<number> {
  const rootDir = resolve(options.targetDir ?? process.cwd());

  const result = await extractSchema({
    rootDir,
    dbUrl: options.dbUrl,
  });

  if (!result) {
    if (options.json) {
      process.stdout.write(
        JSON.stringify({ schema: null, message: "No schema detected" }, null, 2) + "\n",
      );
    } else {
      process.stderr.write("No database schema could be extracted.\n");
      process.stderr.write(
        "Ensure the repository has a supported ORM (Prisma, Drizzle, TypeORM)\n",
      );
      process.stderr.write("or provide --db-url to connect to a database directly.\n");
    }
    return ExitCode.Success;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const markdown = renderSchemaMd(result);
    process.stdout.write(markdown);
  }

  return ExitCode.Success;
}
