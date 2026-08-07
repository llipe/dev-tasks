/**
 * Fetch a specific version of the dev-tasks package from npm into a temp directory.
 * Used by `update` to reconcile against a pinned version instead of the local package.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";

const PACKAGE_NAME = "@llipe.com/dev-tasks";

export interface FetchPackageResult {
  /** Path to the extracted package root (contains .github/, .claude/, .kiro/, etc.) */
  packageDir: string;
  /** Cleanup function — call when done to remove the temp directory */
  cleanup: () => Promise<void>;
}

/**
 * Download and extract a specific version of the package from the npm registry.
 * Returns the path to the extracted package directory and a cleanup function.
 *
 * Uses `npm pack` + `tar` to avoid needing a full install.
 */
export async function fetchPackageVersion(version: string): Promise<FetchPackageResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), "dev-tasks-fetch-"));

  try {
    // Use npm pack to download the tarball for the specific version
    const packResult = await execa("npm", ["pack", `${PACKAGE_NAME}@${version}`, "--pack-destination", tmpDir], {
      cwd: tmpDir,
    });

    // npm pack outputs the filename to stdout
    const tarballName = packResult.stdout.trim().split("\n").pop()!;

    // Extract the tarball — npm pack creates a `package/` directory inside
    await execa("tar", ["xzf", join(tmpDir, tarballName), "-C", tmpDir]);

    // npm pack always extracts to a directory called "package"
    const packageDir = join(tmpDir, "package");

    return {
      packageDir,
      cleanup: async () => {
        await rm(tmpDir, { recursive: true, force: true });
      },
    };
  } catch (err) {
    // Clean up on failure
    await rm(tmpDir, { recursive: true, force: true });
    throw err;
  }
}
