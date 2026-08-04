/**
 * Per-session calibration data recording.
 *
 * Records proposed scope (primary/secondary ids), confidence, unresolved,
 * timestamp, and task text hash. Written to `.dev-tasks/calibration/`
 * for later precision/recall analysis.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { CalibrationRecord, ScopeOutput } from "./types.js";

/* ─── Constants ───────────────────────────────────────────────────────── */

const CALIBRATION_DIR = ".dev-tasks/calibration";

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Compute a SHA-256 hash of the task text (for deduplication and reference).
 */
export function hashTaskText(taskText: string): string {
  return createHash("sha256").update(taskText).digest("hex").slice(0, 16);
}

/**
 * Build a calibration record from scope output and task text.
 */
export function buildCalibrationRecord(
  scopeOutput: ScopeOutput,
  taskText: string,
): CalibrationRecord {
  return {
    timestamp: new Date().toISOString(),
    taskTextHash: hashTaskText(taskText),
    primary: scopeOutput.primary,
    secondary: scopeOutput.secondary,
    confidence: scopeOutput.confidence,
    unresolved: scopeOutput.unresolved,
  };
}

/**
 * Write a calibration record to the calibration directory.
 *
 * @param baseDir - The project root (or working directory)
 * @param record - The calibration record to write
 * @returns The path to the written file
 */
export function writeCalibrationRecord(baseDir: string, record: CalibrationRecord): string {
  const calibDir = resolve(baseDir, CALIBRATION_DIR);
  if (!existsSync(calibDir)) {
    mkdirSync(calibDir, { recursive: true });
  }

  // Filename: <timestamp-millis>-<task-hash>.json
  const ts = new Date(record.timestamp).getTime();
  const filename = `${ts}-${record.taskTextHash}.json`;
  const filePath = resolve(calibDir, filename);

  writeFileSync(filePath, JSON.stringify(record, null, 2) + "\n", "utf-8");

  return filePath;
}
