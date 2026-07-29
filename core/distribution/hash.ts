/**
 * SHA-256 hashing utilities for file content.
 * Deterministic and reusable across distribution and reconciliation.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Compute SHA-256 hex digest of a string.
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Compute SHA-256 hex digest of a file's content.
 * Reads the file as UTF-8 text.
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath, "utf-8");
  return hashContent(content);
}
