/**
 * Custom OpenAPI breaking-change comparator.
 *
 * Detects breaking changes between two OpenAPI 3.x specifications
 * without an LLM or external binary dependency (replaces `oasdiff`).
 *
 * Breaking-change classes detected:
 * - Removed path
 * - Removed operation (HTTP method) from a path
 * - New required parameter (query, header, path, cookie)
 * - Removed response status code
 * - Changed parameter type
 * - Narrowed enum (values removed from parameter/schema)
 * - New required request body field
 * - Changed request body field type
 *
 * Non-breaking changes detected:
 * - Added path
 * - Added optional parameter
 * - Widened enum (values added)
 * - New optional request body field
 * - Added response status code
 */

import type { DiffFinding, ContractDiffResult } from "./types.js";

/**
 * Minimal OpenAPI document shape for diffing.
 * We only parse what we need for breaking-change detection.
 */
interface OpenApiSpec {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
}

interface ParameterObject {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: SchemaObject;
}

interface SchemaObject {
  type?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SchemaObject>;
}

interface RequestBodyObject {
  required?: boolean;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface OperationObject {
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, unknown>;
}

/**
 * Compare two OpenAPI specs and return diff findings.
 */
export function diffOpenApi(base: unknown, head: unknown): ContractDiffResult {
  const findings: DiffFinding[] = [];
  const baseSpec = base as OpenApiSpec;
  const headSpec = head as OpenApiSpec;

  const basePaths = baseSpec.paths ?? {};
  const headPaths = headSpec.paths ?? {};

  // Check removed paths
  for (const path of Object.keys(basePaths)) {
    if (!(path in headPaths)) {
      findings.push({
        kind: "breaking",
        code: "path-removed",
        message: `Path '${path}' was removed`,
        path: `paths.${path}`,
      });
      continue;
    }

    // Check operations within path
    const basePathItem = basePaths[path] as Record<string, unknown>;
    const headPathItem = headPaths[path] as Record<string, unknown>;

    diffPathItem(path, basePathItem, headPathItem, findings);
  }

  // Check added paths (non-breaking, informational)
  for (const path of Object.keys(headPaths)) {
    if (!(path in basePaths)) {
      findings.push({
        kind: "non-breaking",
        code: "path-added",
        message: `Path '${path}' was added`,
        path: `paths.${path}`,
      });
    }
  }

  return {
    contractType: "openapi",
    breaking: findings.some((f) => f.kind === "breaking"),
    findings,
  };
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

function diffPathItem(
  path: string,
  baseItem: Record<string, unknown>,
  headItem: Record<string, unknown>,
  findings: DiffFinding[],
): void {
  for (const method of HTTP_METHODS) {
    const baseOp = baseItem[method] as OperationObject | undefined;
    const headOp = headItem[method] as OperationObject | undefined;

    if (baseOp && !headOp) {
      findings.push({
        kind: "breaking",
        code: "operation-removed",
        message: `Operation '${method.toUpperCase()} ${path}' was removed`,
        path: `paths.${path}.${method}`,
      });
      continue;
    }

    if (!baseOp && headOp) {
      findings.push({
        kind: "non-breaking",
        code: "operation-added",
        message: `Operation '${method.toUpperCase()} ${path}' was added`,
        path: `paths.${path}.${method}`,
      });
      continue;
    }

    if (baseOp && headOp) {
      diffOperation(path, method, baseOp, headOp, findings);
    }
  }
}

function diffOperation(
  path: string,
  method: string,
  baseOp: OperationObject,
  headOp: OperationObject,
  findings: DiffFinding[],
): void {
  const opPath = `paths.${path}.${method}`;

  // Diff parameters
  diffParameters(opPath, baseOp.parameters ?? [], headOp.parameters ?? [], findings);

  // Diff request body
  diffRequestBody(opPath, baseOp.requestBody, headOp.requestBody, findings);

  // Diff responses
  diffResponses(opPath, baseOp.responses ?? {}, headOp.responses ?? {}, findings);
}

function diffParameters(
  opPath: string,
  baseParams: ParameterObject[],
  headParams: ParameterObject[],
  findings: DiffFinding[],
): void {
  // Index params by name+in
  const baseMap = new Map<string, ParameterObject>();
  for (const p of baseParams) {
    if (p.name && p.in) baseMap.set(`${p.in}:${p.name}`, p);
  }

  const headMap = new Map<string, ParameterObject>();
  for (const p of headParams) {
    if (p.name && p.in) headMap.set(`${p.in}:${p.name}`, p);
  }

  // New required parameters → breaking
  for (const [key, headParam] of headMap) {
    const baseParam = baseMap.get(key);
    if (!baseParam && headParam.required) {
      findings.push({
        kind: "breaking",
        code: "parameter-added-required",
        message: `New required parameter '${headParam.name}' (${headParam.in}) added`,
        path: `${opPath}.parameters.${headParam.name}`,
      });
    } else if (!baseParam && !headParam.required) {
      findings.push({
        kind: "non-breaking",
        code: "parameter-added-optional",
        message: `New optional parameter '${headParam.name}' (${headParam.in}) added`,
        path: `${opPath}.parameters.${headParam.name}`,
      });
    } else if (baseParam) {
      // Existing param: check type changes
      diffParamSchema(opPath, headParam.name ?? "", baseParam, headParam, findings);
    }
  }

  // Removed parameters → non-breaking (server relaxation)
  for (const [key, baseParam] of baseMap) {
    if (!headMap.has(key)) {
      findings.push({
        kind: "non-breaking",
        code: "parameter-removed",
        message: `Parameter '${baseParam.name}' (${baseParam.in}) was removed`,
        path: `${opPath}.parameters.${baseParam.name}`,
      });
    }
  }
}

function diffParamSchema(
  opPath: string,
  name: string,
  baseParam: ParameterObject,
  headParam: ParameterObject,
  findings: DiffFinding[],
): void {
  const baseType = baseParam.schema?.type;
  const headType = headParam.schema?.type;

  if (baseType && headType && baseType !== headType) {
    findings.push({
      kind: "breaking",
      code: "parameter-type-changed",
      message: `Parameter '${name}' type changed from '${baseType}' to '${headType}'`,
      path: `${opPath}.parameters.${name}.schema.type`,
    });
  }

  // Check enum narrowing/widening
  diffEnum(
    `${opPath}.parameters.${name}.schema.enum`,
    baseParam.schema?.enum,
    headParam.schema?.enum,
    findings,
  );
}

function diffEnum(
  path: string,
  baseEnum: unknown[] | undefined,
  headEnum: unknown[] | undefined,
  findings: DiffFinding[],
): void {
  if (!baseEnum || !headEnum) return;

  const baseSet = new Set(baseEnum.map(String));
  const headSet = new Set(headEnum.map(String));

  const removed = [...baseSet].filter((v) => !headSet.has(v));
  const added = [...headSet].filter((v) => !baseSet.has(v));

  if (removed.length > 0) {
    findings.push({
      kind: "breaking",
      code: "enum-narrowed",
      message: `Enum values removed: ${removed.join(", ")}`,
      path,
    });
  }

  if (added.length > 0) {
    findings.push({
      kind: "non-breaking",
      code: "enum-widened",
      message: `Enum values added: ${added.join(", ")}`,
      path,
    });
  }
}

function diffRequestBody(
  opPath: string,
  baseBody: RequestBodyObject | undefined,
  headBody: RequestBodyObject | undefined,
  findings: DiffFinding[],
): void {
  if (!baseBody && headBody?.required) {
    findings.push({
      kind: "breaking",
      code: "request-body-added-required",
      message: "Required request body was added",
      path: `${opPath}.requestBody`,
    });
    return;
  }

  if (!baseBody || !headBody) return;

  // Compare schemas across content types
  const baseContent = baseBody.content ?? {};
  const headContent = headBody.content ?? {};

  for (const contentType of Object.keys(headContent)) {
    const baseSchema = baseContent[contentType]?.schema;
    const headSchema = headContent[contentType]?.schema;

    if (baseSchema && headSchema) {
      diffSchema(
        `${opPath}.requestBody.content.${contentType}.schema`,
        baseSchema,
        headSchema,
        findings,
      );
    }
  }
}

function diffSchema(
  path: string,
  baseSchema: SchemaObject,
  headSchema: SchemaObject,
  findings: DiffFinding[],
): void {
  // Type change
  if (baseSchema.type && headSchema.type && baseSchema.type !== headSchema.type) {
    findings.push({
      kind: "breaking",
      code: "schema-type-changed",
      message: `Schema type changed from '${baseSchema.type}' to '${headSchema.type}'`,
      path: `${path}.type`,
    });
  }

  // Enum narrowing/widening
  diffEnum(`${path}.enum`, baseSchema.enum, headSchema.enum, findings);

  // New required fields
  const baseRequired = new Set(baseSchema.required ?? []);
  const headRequired = new Set(headSchema.required ?? []);
  const baseProps = baseSchema.properties ?? {};
  const headProps = headSchema.properties ?? {};

  for (const field of headRequired) {
    if (!baseRequired.has(field) && !(field in baseProps)) {
      // Truly new required field (not previously optional)
      findings.push({
        kind: "breaking",
        code: "field-added-required",
        message: `New required field '${field}' added`,
        path: `${path}.properties.${field}`,
      });
    } else if (!baseRequired.has(field) && field in baseProps) {
      // Previously optional, now required
      findings.push({
        kind: "breaking",
        code: "field-made-required",
        message: `Field '${field}' changed from optional to required`,
        path: `${path}.properties.${field}`,
      });
    }
  }

  // New optional fields (non-breaking)
  for (const field of Object.keys(headProps)) {
    if (!(field in baseProps) && !headRequired.has(field)) {
      findings.push({
        kind: "non-breaking",
        code: "field-added-optional",
        message: `New optional field '${field}' added`,
        path: `${path}.properties.${field}`,
      });
    }
  }

  // Recurse into shared properties for type changes
  for (const field of Object.keys(headProps)) {
    if (field in baseProps) {
      diffSchema(`${path}.properties.${field}`, baseProps[field], headProps[field], findings);
    }
  }
}

function diffResponses(
  opPath: string,
  baseResponses: Record<string, unknown>,
  headResponses: Record<string, unknown>,
  findings: DiffFinding[],
): void {
  // Removed response status code → breaking
  for (const code of Object.keys(baseResponses)) {
    if (!(code in headResponses)) {
      findings.push({
        kind: "breaking",
        code: "response-removed",
        message: `Response status '${code}' was removed`,
        path: `${opPath}.responses.${code}`,
      });
    }
  }

  // Added response status code → non-breaking
  for (const code of Object.keys(headResponses)) {
    if (!(code in baseResponses)) {
      findings.push({
        kind: "non-breaking",
        code: "response-added",
        message: `Response status '${code}' was added`,
        path: `${opPath}.responses.${code}`,
      });
    }
  }
}
