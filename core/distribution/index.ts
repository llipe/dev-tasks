/**
 * Distribution module — install, update, status, pin, doctor, profiles.
 */
export { hashContent, hashFile } from "./hash.js";
export { readManifest, writeManifest } from "./manifest.js";
export type { Manifest, ManagedFileEntry, SkillEntry } from "./manifest.js";
export { installFiles, installSkills } from "./install.js";
export type { InstallOptions, InstallResult } from "./install.js";
export { runUpdate } from "./update.js";
export type { UpdateOptions, UpdateResult, UpdateFileResult } from "./update.js";
export { createBackupDir, backupFile } from "./backup.js";
export type { BackupResult } from "./backup.js";
export { writePin, readPin, removePin } from "./pin.js";
export { fetchPackageVersion } from "./fetch-package.js";
export type { FetchPackageResult } from "./fetch-package.js";
export { getStatus } from "./status.js";
export type { StatusResult } from "./status.js";
export {
  runDoctor,
  checkNodeVersion,
  checkGitVersion,
  checkCacheDir,
  checkVersionSkew,
  checkClaudeHooksWiring,
  checkFoundationDocNames,
} from "./doctor.js";
export type { DoctorCheck, DoctorOptions } from "./doctor.js";
export {
  resolveProfile,
  isValidProfile,
  PROFILE_PATHS,
  VALID_PROFILES,
  INSTALL_IF_ABSENT_FILES,
} from "./profiles.js";
export type { Profile, Platform, ManagedPath, InstallIfAbsentFile } from "./profiles.js";
export { deliverInstallIfAbsentFiles } from "./install-if-absent.js";
export type { InstallIfAbsentResult } from "./install-if-absent.js";
export { detectOldFoundationDocs, runDocsMigration, formatDocsMigration } from "./migrate-docs.js";
export type { DocRename, DocsMigrationResult, DocsMigrationOptions } from "./migrate-docs.js";
