import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getStatus } from "#core/distribution/status.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/status", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-status-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeManifest(version: string, pinned: string): void {
    const dir = join(tmpDir, ".dev-tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        version,
        pinned,
        installed_at: "2024-01-01T00:00:00.000Z",
        skills: [],
        extraction: {},
      }),
      "utf-8",
    );
  }

  function writePin(version: string): void {
    const dir = join(tmpDir, ".dev-tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "version"), version + "\n", "utf-8");
  }

  it("reports installed version from manifest", async () => {
    writeManifest("0.1.0", "0.1.0");
    const result = await getStatus(tmpDir, "0.2.0");
    expect(result.installed).toBe("0.1.0");
  });

  it("reports pinned version from .dev-tasks/version file", async () => {
    writeManifest("0.1.0", "0.1.0");
    writePin("0.1.5");
    const result = await getStatus(tmpDir, "0.2.0");
    expect(result.pinned).toBe("0.1.5");
  });

  it("reports pinned as null if no pin file exists", async () => {
    writeManifest("0.1.0", "0.1.0");
    const result = await getStatus(tmpDir, "0.2.0");
    expect(result.pinned).toBeNull();
  });

  it("reports latest version from argument", async () => {
    writeManifest("0.1.0", "0.1.0");
    const result = await getStatus(tmpDir, "0.3.0");
    expect(result.latest).toBe("0.3.0");
  });

  it("reports all three versions", async () => {
    writeManifest("0.1.0", "0.1.0");
    writePin("0.2.0");
    const result = await getStatus(tmpDir, "0.3.0");
    expect(result.installed).toBe("0.1.0");
    expect(result.pinned).toBe("0.2.0");
    expect(result.latest).toBe("0.3.0");
  });

  it("reports installed as null if not installed", async () => {
    const result = await getStatus(tmpDir, "0.1.0");
    expect(result.installed).toBeNull();
    expect(result.pinned).toBeNull();
  });

  it("marks upToDate correctly when installed matches latest", async () => {
    writeManifest("0.2.0", "0.2.0");
    const result = await getStatus(tmpDir, "0.2.0");
    expect(result.upToDate).toBe(true);
  });

  it("marks upToDate false when installed differs from latest", async () => {
    writeManifest("0.1.0", "0.1.0");
    const result = await getStatus(tmpDir, "0.2.0");
    expect(result.upToDate).toBe(false);
  });

  it("marks upToDate based on pin when pinned", async () => {
    writeManifest("0.1.0", "0.1.0");
    writePin("0.1.0");
    const result = await getStatus(tmpDir, "0.2.0");
    // When pinned, upToDate means installed matches pin
    expect(result.upToDate).toBe(true);
  });
});
