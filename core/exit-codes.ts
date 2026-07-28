/**
 * Process exit codes per spec §6.7.
 * Exported as a const object for use across all CLI binaries.
 */
export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidUsage: 2,
  NetworkError: 3,
  AuthError: 4,
  NotFound: 5,
  Conflict: 6,
  Timeout: 7,
  RateLimit: 8,
  ValidationError: 9,
  ConfigurationError: 10,
  DependencyError: 11,
  PermissionDenied: 12,
  MissingRequiredField: 13,
  ReconciliationConflict: 14,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
