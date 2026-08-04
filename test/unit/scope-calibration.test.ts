/**
 * Unit tests for core/scope/calibration.ts
 *
 * Tests: calibration record shape; task text hashing; file writing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  hashTaskText,
  buildCalibrationRecord,
  writeCalibrationRecord,
} from "#core/scope/calibration.js";
import type { ScopeOutput, CalibrationRecord } from "#core/scope/types.js";

/* ─── Fixtures ────────────────────────────────────────────────────────── */

function validScope(): ScopeOutput {
  return {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: ["unknown-capability"],
    rationale: "Auth service handles the login flow.",
  };
}

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("hashTaskText", () => {
  it("returns a 16-char hex string", () => {
    const hash = hashTaskText("Add rate limiting to auth");
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    const h1 = hashTaskText("same text");
    const h2 = hashTaskText("same text");
    expect(h1).toBe(h2);
  });

  it("differs for different inputs", () => {
    const h1 = hashTaskText("text A");
    const h2 = hashTaskText("text B");
    expect(h1).not.toBe(h2);
  });
});

describe("buildCalibrationRecord", () => {
  it("includes all required fields", () => {
    const record = buildCalibrationRecord(validScope(), "Add rate limiting");
    expect(record.timestamp).toBeDefined();
    expect(record.taskTextHash).toMatch(/^[a-f0-9]{16}$/);
    expect(record.primary).toEqual(["auth-service"]);
    expect(record.secondary).toEqual(["user-service"]);
    expect(record.confidence).toBe("high");
    expect(record.unresolved).toEqual(["unknown-capability"]);
  });

  it("uses ISO timestamp", () => {
    const record = buildCalibrationRecord(validScope(), "task");
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });
});

describe("writeCalibrationRecord", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dt-calib-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates calibration directory if not present", () => {
    const record = buildCalibrationRecord(validScope(), "task");
    writeCalibrationRecord(tmpDir, record);

    const calibDir = join(tmpDir, ".dev-tasks", "calibration");
    expect(existsSync(calibDir)).toBe(true);
  });

  it("writes a JSON file", () => {
    const record = buildCalibrationRecord(validScope(), "task");
    const path = writeCalibrationRecord(tmpDir, record);

    expect(existsSync(path)).toBe(true);
    const content = JSON.parse(readFileSync(path, "utf-8")) as CalibrationRecord;
    expect(content.primary).toEqual(["auth-service"]);
  });

  it("filename contains timestamp and hash", () => {
    const record = buildCalibrationRecord(validScope(), "my task");
    const path = writeCalibrationRecord(tmpDir, record);

    const filename = path.split("/").pop()!;
    expect(filename).toMatch(/^\d+-[a-f0-9]{16}\.json$/);
  });

  it("can write multiple records", () => {
    const record1 = buildCalibrationRecord(validScope(), "task 1");
    const record2 = buildCalibrationRecord(validScope(), "task 2");
    writeCalibrationRecord(tmpDir, record1);
    writeCalibrationRecord(tmpDir, record2);

    const calibDir = join(tmpDir, ".dev-tasks", "calibration");
    const files = readdirSync(calibDir);
    expect(files.length).toBe(2);
  });
});
