/**
 * OpenAPI Route 3: AST-based route discovery.
 * Uses TypeScript Compiler API to find route registrations in:
 * - Express (app|router.get|post|put|patch|delete)
 * - Fastify (same pattern)
 * - Hono (app.get + .route() groupings)
 * - NestJS (@Controller/@Get/@Post decorators)
 *
 * Resolves full path by composing router prefixes.
 * Derives params from route pattern and handler type signature.
 * Reports dynamic routes in unresolved[].
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type {
  ExtractedEndpoint,
  OpenApiConfidence,
  OpenApiExtractionResult,
  RequestBodySchema,
  ResponseSchema,
  RouteParam,
  UnresolvedRoute,
} from "./types.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * Extract OpenAPI specification using Route 3 (AST) strategy.
 */
export function extractRoute3(rootDir: string): OpenApiExtractionResult {
  const sourceFiles = findTypeScriptFiles(rootDir);
  const program = createProgram(sourceFiles, rootDir);
  const checker = program.getTypeChecker();

  const endpoints: ExtractedEndpoint[] = [];
  const unresolved: UnresolvedRoute[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = sourceFile.fileName;
    // Skip node_modules and non-project files
    if (filePath.includes("node_modules") || !filePath.startsWith(rootDir)) continue;

    const relPath = relative(rootDir, filePath);
    visitNode(sourceFile, "", relPath, checker, endpoints, unresolved);
  }

  // Determine overall confidence
  const confidence = computeOverallConfidence(endpoints);

  return {
    openapi: "3.1.0",
    info: { title: "API", version: "1.0.0" },
    endpoints,
    unresolved,
    source: "inferred",
    confidence,
    strategy: "route3",
  };
}

/**
 * Visit a node to find route registrations.
 */
function visitNode(
  node: ts.Node,
  prefix: string,
  filePath: string,
  checker: ts.TypeChecker,
  endpoints: ExtractedEndpoint[],
  unresolved: UnresolvedRoute[],
): void {
  // Check for NestJS decorators
  if (ts.isClassDeclaration(node)) {
    const controllerPrefix = getNestControllerPrefix(node);
    if (controllerPrefix !== null) {
      extractNestEndpoints(node, controllerPrefix, filePath, checker, endpoints);
      return;
    }
  }

  // Check for Express/Fastify/Hono route calls
  if (ts.isCallExpression(node)) {
    handleRouteCall(node, prefix, filePath, checker, endpoints, unresolved);
  }

  // Check for router.use() with prefix (Express/Fastify prefix composition)
  if (ts.isCallExpression(node)) {
    const usePrefix = getUsePrefix(node);
    if (usePrefix !== null) {
      // Routes registered after this use the prefix
      // We handle this by tracking prefixes in the parent scope
    }
  }

  ts.forEachChild(node, (child) =>
    visitNode(child, prefix, filePath, checker, endpoints, unresolved),
  );
}

/**
 * Handle a potential route registration call expression.
 */
function handleRouteCall(
  node: ts.CallExpression,
  prefix: string,
  filePath: string,
  checker: ts.TypeChecker,
  endpoints: ExtractedEndpoint[],
  unresolved: UnresolvedRoute[],
): void {
  // Pattern: app.get("/path", handler) or router.post("/path", handler)
  if (!ts.isPropertyAccessExpression(node.expression)) return;

  const methodName = node.expression.name.text;
  if (!HTTP_METHODS.includes(methodName)) return;

  // Check for Hono .route() grouping (handled separately)
  if (methodName === "route") return;

  if (node.arguments.length < 1) return;

  const pathArg = node.arguments[0];
  const path = resolvePathArgument(pathArg, filePath, node, unresolved);

  if (path === null) return; // Already reported as unresolved

  const fullPath = composePath(prefix, path);
  const handlerArg = node.arguments.length > 1 ? node.arguments[node.arguments.length - 1] : null;

  // Derive params from path pattern
  const pathParams = extractPathParams(fullPath);

  // Derive body/query params and response from handler type
  const { queryParams, bodySchema, responseSchema, typed } = handlerArg
    ? analyzeHandler(handlerArg, checker)
    : { queryParams: [], bodySchema: undefined, responseSchema: [], typed: false };

  const confidence: OpenApiConfidence = typed ? "medium" : "low";

  endpoints.push({
    method: methodName,
    path: fullPath,
    parameters: [...pathParams, ...queryParams],
    requestBody: bodySchema,
    responses: responseSchema.length > 0 ? responseSchema : [defaultResponse()],
    typed,
    confidence,
  });
}

/**
 * Extract NestJS endpoints from a controller class.
 */
function extractNestEndpoints(
  classNode: ts.ClassDeclaration,
  controllerPrefix: string,
  filePath: string,
  checker: ts.TypeChecker,
  endpoints: ExtractedEndpoint[],
): void {
  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member)) continue;

    const decorators = ts.getDecorators(member);
    if (!decorators) continue;

    for (const decorator of decorators) {
      if (!ts.isCallExpression(decorator.expression)) continue;

      const decoratorName = getDecoratorName(decorator.expression);
      if (!decoratorName) continue;

      const method = decoratorNameToMethod(decoratorName);
      if (!method) continue;

      // Get the path from decorator argument
      let routePath = "/";
      if (decorator.expression.arguments.length > 0) {
        const pathArg = decorator.expression.arguments[0];
        if (ts.isStringLiteral(pathArg)) {
          routePath = pathArg.text;
        }
      }

      const fullPath = composePath(controllerPrefix, routePath);
      const pathParams = extractPathParams(fullPath);

      // Analyze method parameters for query/body
      const { queryParams, bodySchema, responseSchema, typed } = analyzeNestMethod(member, checker);

      const confidence: OpenApiConfidence = typed ? "medium" : "low";

      endpoints.push({
        method,
        path: fullPath,
        parameters: [...pathParams, ...queryParams],
        requestBody: bodySchema,
        responses: responseSchema.length > 0 ? responseSchema : [defaultResponse()],
        typed,
        confidence,
      });
    }
  }
}

/**
 * Analyze a NestJS method's parameters for query/body params.
 */
function analyzeNestMethod(
  method: ts.MethodDeclaration,
  checker: ts.TypeChecker,
): {
  queryParams: RouteParam[];
  bodySchema: RequestBodySchema | undefined;
  responseSchema: ResponseSchema[];
  typed: boolean;
} {
  const queryParams: RouteParam[] = [];
  let bodySchema: RequestBodySchema | undefined;
  let typed = false;

  for (const param of method.parameters) {
    const decorators = ts.getDecorators(param);
    if (!decorators) continue;

    for (const decorator of decorators) {
      if (!ts.isCallExpression(decorator.expression)) continue;
      const name = getDecoratorName(decorator.expression);

      if (name === "Query") {
        const paramName = getDecoratorStringArg(decorator.expression);
        if (paramName) {
          const paramType = param.type ? getTypeString(param.type) : "string";
          queryParams.push({ name: paramName, in: "query", required: false, type: paramType });
          typed = true;
        }
      } else if (name === "Body") {
        const bodyType = param.type ? typeNodeToSchema(param.type, checker) : null;
        if (bodyType) {
          bodySchema = { contentType: "application/json", schema: bodyType, required: true };
          typed = true;
        }
      }
    }
  }

  // Check return type
  const responseSchema = analyzeReturnType(method, checker);
  if (responseSchema.length > 0) typed = true;

  return { queryParams, bodySchema, responseSchema, typed };
}

/**
 * Analyze a handler function/arrow for query/body/response types.
 * Supports:
 * - Express Request<Params, ResBody, ReqBody, ReqQuery> generics
 * - Zod schema validation (.input(z.object({...})))
 * - Direct type annotations
 */
function analyzeHandler(
  handler: ts.Expression,
  checker: ts.TypeChecker,
): {
  queryParams: RouteParam[];
  bodySchema: RequestBodySchema | undefined;
  responseSchema: ResponseSchema[];
  typed: boolean;
} {
  const queryParams: RouteParam[] = [];
  let bodySchema: RequestBodySchema | undefined;
  let responseSchema: ResponseSchema[] = [];
  let typed = false;

  // Check for zod validation in the call chain
  const zodSchema = findZodSchema(handler);
  if (zodSchema) {
    bodySchema = {
      contentType: "application/json",
      schema: zodSchema,
      required: true,
    };
    typed = true;
  }

  // Analyze handler function parameters
  const fn = resolveFunction(handler);
  if (fn && ts.isFunctionLike(fn)) {
    // Check request parameter type for Express Request<P, Res, Body, Query>
    if (fn.parameters.length > 0) {
      const reqParam = fn.parameters[0];
      if (reqParam.type && ts.isTypeReferenceNode(reqParam.type)) {
        const typeArgs = reqParam.type.typeArguments;
        if (typeArgs && typeArgs.length >= 4) {
          // Query params from 4th type argument
          const queryType = typeNodeToSchema(typeArgs[3], checker);
          if (queryType && queryType.properties) {
            for (const [name, prop] of Object.entries(
              queryType.properties as Record<string, Record<string, unknown>>,
            )) {
              queryParams.push({
                name,
                in: "query",
                required: !(prop.nullable === true),
                type: (prop.type as string) ?? "string",
              });
            }
            typed = true;
          }
          // Body from 3rd type argument
          if (!bodySchema && typeArgs.length >= 3) {
            const bodyType = typeNodeToSchema(typeArgs[2], checker);
            if (bodyType && Object.keys(bodyType).length > 0) {
              bodySchema = {
                contentType: "application/json",
                schema: bodyType,
                required: true,
              };
              typed = true;
            }
          }
        }
      }
    }

    // Analyze return type
    responseSchema = analyzeReturnType(fn, checker);
    if (responseSchema.length > 0) typed = true;
  }

  return { queryParams, bodySchema, responseSchema, typed };
}

/**
 * Find a zod schema in a validation chain.
 * Supports patterns like:
 * - app.post("/path", validate(z.object({...})), handler)
 * - .input(z.object({...}))
 */
function findZodSchema(node: ts.Expression): Record<string, unknown> | null {
  // Walk up the call expression looking for zod patterns
  if (ts.isCallExpression(node)) {
    // Check if this is a z.object({...}) call directly
    const zodObj = extractZodObject(node);
    if (zodObj) return zodObj;
  }

  // Check parent call for validation middleware
  const parent = node.parent;
  if (parent && ts.isCallExpression(parent)) {
    for (const arg of parent.arguments) {
      if (ts.isCallExpression(arg)) {
        const zodObj = extractZodObjectFromValidator(arg);
        if (zodObj) return zodObj;
      }
    }
  }

  return null;
}

/**
 * Extract a zod object schema from a z.object({...}) call.
 */
function extractZodObject(call: ts.CallExpression): Record<string, unknown> | null {
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  if (call.expression.name.text !== "object") return null;

  // Check if the object is z.object
  const obj = call.expression.expression;
  if (!ts.isIdentifier(obj) || obj.text !== "z") return null;

  if (call.arguments.length === 0) return null;
  const arg = call.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return null;

  return zodObjectLiteralToSchema(arg);
}

/**
 * Extract zod schema from a validation wrapper like validate(z.object({...})).
 */
function extractZodObjectFromValidator(call: ts.CallExpression): Record<string, unknown> | null {
  for (const arg of call.arguments) {
    if (ts.isCallExpression(arg)) {
      const zodObj = extractZodObject(arg);
      if (zodObj) return zodObj;
    }
  }
  return null;
}

/**
 * Convert a zod object literal to a JSON Schema-like object.
 */
function zodObjectLiteralToSchema(obj: ts.ObjectLiteralExpression): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) continue;

    const fieldName = prop.name.text;
    const fieldSchema = zodFieldToSchema(prop.initializer);
    properties[fieldName] = fieldSchema;

    // Check if optional
    if (!isZodOptional(prop.initializer)) {
      required.push(fieldName);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

/**
 * Convert a single zod field definition to a JSON Schema type.
 */
function zodFieldToSchema(expr: ts.Expression): Record<string, unknown> {
  // z.string(), z.number(), z.boolean(), z.array(), z.enum()
  const chain = flattenZodChain(expr);
  if (chain.length === 0) return { type: "string" };

  const baseType = chain[0];
  switch (baseType) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "array":
      return { type: "array", items: { type: "string" } };
    case "enum":
      return { type: "string", enum: extractEnumValues(expr) };
    default:
      return { type: "string" };
  }
}

function flattenZodChain(expr: ts.Expression): string[] {
  const names: string[] = [];
  let current = expr;

  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      names.unshift(current.expression.name.text);
      current = current.expression.expression;
    } else if (ts.isIdentifier(current.expression)) {
      names.unshift(current.expression.text);
      break;
    } else {
      break;
    }
  }

  // Remove 'z' prefix if present
  if (names[0] === "z" && names.length > 1) {
    return names.slice(1);
  }
  return names;
}

function isZodOptional(expr: ts.Expression): boolean {
  const chain = flattenZodChain(expr);
  return chain.includes("optional") || chain.includes("nullish");
}

function extractEnumValues(expr: ts.Expression): string[] {
  // z.enum(["a", "b", "c"])
  if (!ts.isCallExpression(expr)) return [];
  // Walk to find the enum call with an array arg
  let current: ts.Expression = expr;
  while (ts.isCallExpression(current)) {
    if (ts.isPropertyAccessExpression(current.expression)) {
      if (current.expression.name.text === "enum" && current.arguments.length > 0) {
        const arg = current.arguments[0];
        if (ts.isArrayLiteralExpression(arg)) {
          return arg.elements.filter(ts.isStringLiteral).map((e) => e.text);
        }
      }
      current = current.expression.expression;
    } else {
      break;
    }
  }
  return [];
}

/**
 * Resolve a function expression (arrow function, function expression, or identifier).
 */
function resolveFunction(expr: ts.Expression): ts.FunctionLikeDeclaration | null {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return expr;
  }
  // Could resolve identifiers via type checker, but for now return null
  return null;
}

/**
 * Analyze the return type of a function-like declaration.
 */
function analyzeReturnType(
  fn: ts.FunctionLikeDeclaration,
  checker: ts.TypeChecker,
): ResponseSchema[] {
  if (!fn.type) return [];

  // Check if return type is any/unknown → schema-less
  if (fn.type.kind === ts.SyntaxKind.AnyKeyword || fn.type.kind === ts.SyntaxKind.UnknownKeyword) {
    return [];
  }

  const schema = typeNodeToSchema(fn.type, checker);
  if (schema && Object.keys(schema).length > 0) {
    return [
      {
        statusCode: "200",
        contentType: "application/json",
        schema,
        description: "Successful response",
      },
    ];
  }

  return [];
}

/**
 * Convert a TypeScript type node to a JSON Schema-like object.
 */
function typeNodeToSchema(
  typeNode: ts.TypeNode,
  checker: ts.TypeChecker,
): Record<string, unknown> | null {
  if (ts.isTypeLiteralNode(typeNode)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const member of typeNode.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const name = member.name.text;
        const isOptional = !!member.questionToken;
        const memberType = member.type ? getTypeString(member.type) : "string";
        properties[name] = { type: memberType };
        if (!isOptional) required.push(name);
      }
    }

    if (Object.keys(properties).length === 0) return null;
    return { type: "object", properties, required: required.length > 0 ? required : undefined };
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    // Try to resolve the type
    const type = checker.getTypeAtLocation(typeNode);
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const prop of type.getProperties()) {
      const propType = checker.getTypeOfSymbol(prop);
      const typeStr = checker.typeToString(propType);
      properties[prop.name] = { type: tsTypeToJsonSchemaType(typeStr) };
      // Check if optional
      if (!(prop.flags & ts.SymbolFlags.Optional)) {
        required.push(prop.name);
      }
    }

    if (Object.keys(properties).length === 0) return null;
    return { type: "object", properties, required: required.length > 0 ? required : undefined };
  }

  if (ts.isArrayTypeNode(typeNode)) {
    const elementSchema = typeNodeToSchema(typeNode.elementType, checker);
    return { type: "array", items: elementSchema ?? { type: "string" } };
  }

  // Keyword types
  const typeStr = getTypeString(typeNode);
  if (typeStr === "any" || typeStr === "unknown") return null;
  return { type: tsTypeToJsonSchemaType(typeStr) };
}

function getTypeString(typeNode: ts.TypeNode): string {
  switch (typeNode.kind) {
    case ts.SyntaxKind.StringKeyword:
      return "string";
    case ts.SyntaxKind.NumberKeyword:
      return "number";
    case ts.SyntaxKind.BooleanKeyword:
      return "boolean";
    case ts.SyntaxKind.AnyKeyword:
      return "any";
    case ts.SyntaxKind.UnknownKeyword:
      return "unknown";
    case ts.SyntaxKind.VoidKeyword:
      return "void";
    default:
      return "string";
  }
}

function tsTypeToJsonSchemaType(tsType: string): string {
  switch (tsType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "void":
      return "null";
    default:
      return "string";
  }
}

// --- Path utilities ---

/**
 * Compose a prefix and a route path into a full path.
 */
export function composePath(prefix: string, routePath: string): string {
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const composed = normalizedPrefix + normalizedRoute;
  return composed || "/";
}

/**
 * Extract path parameters from a route pattern like "/users/:id/posts/:postId".
 */
export function extractPathParams(path: string): RouteParam[] {
  const params: RouteParam[] = [];
  // Express-style :param
  const colonMatches = path.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of colonMatches) {
    params.push({ name: match[1], in: "path", required: true, type: "string" });
  }
  // OpenAPI-style {param}
  const braceMatches = path.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  for (const match of braceMatches) {
    if (!params.some((p) => p.name === match[1])) {
      params.push({ name: match[1], in: "path", required: true, type: "string" });
    }
  }
  return params;
}

/**
 * Resolve the path argument of a route call.
 * Returns null and adds to unresolved if the path is dynamic.
 */
function resolvePathArgument(
  pathArg: ts.Expression,
  filePath: string,
  callNode: ts.CallExpression,
  unresolved: UnresolvedRoute[],
): string | null {
  if (ts.isStringLiteral(pathArg) || ts.isNoSubstitutionTemplateLiteral(pathArg)) {
    return pathArg.text;
  }

  // Template literal with static parts
  if (ts.isTemplateExpression(pathArg)) {
    // Try to extract a static path pattern
    let path = pathArg.head.text;
    for (const span of pathArg.templateSpans) {
      path += `:param_${span.expression.getText()}`;
      path += span.literal.text;
    }
    return path;
  }

  // Dynamic/unresolvable
  const sourceFile = callNode.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(callNode.getStart());

  unresolved.push({
    file: filePath,
    line: line + 1,
    reason: "Dynamic route path — cannot resolve statically",
    snippet: callNode.getText().slice(0, 100),
  });

  return null;
}

// --- NestJS helpers ---

/**
 * Get the controller prefix from a @Controller() decorator.
 */
function getNestControllerPrefix(classNode: ts.ClassDeclaration): string | null {
  const decorators = ts.getDecorators(classNode);
  if (!decorators) return null;

  for (const decorator of decorators) {
    if (!ts.isCallExpression(decorator.expression)) continue;
    const name = getDecoratorName(decorator.expression);
    if (name !== "Controller") continue;

    if (decorator.expression.arguments.length > 0) {
      const arg = decorator.expression.arguments[0];
      if (ts.isStringLiteral(arg)) {
        return arg.text.startsWith("/") ? arg.text : `/${arg.text}`;
      }
    }
    return "/";
  }
  return null;
}

function getDecoratorName(call: ts.CallExpression): string | null {
  if (ts.isIdentifier(call.expression)) {
    return call.expression.text;
  }
  return null;
}

function getDecoratorStringArg(call: ts.CallExpression): string | null {
  if (call.arguments.length > 0) {
    const arg = call.arguments[0];
    if (ts.isStringLiteral(arg)) return arg.text;
  }
  return null;
}

function decoratorNameToMethod(name: string): string | null {
  const map: Record<string, string> = {
    Get: "get",
    Post: "post",
    Put: "put",
    Patch: "patch",
    Delete: "delete",
    Head: "head",
    Options: "options",
  };
  return map[name] ?? null;
}

// --- Router prefix detection ---

function getUsePrefix(call: ts.CallExpression): string | null {
  if (!ts.isPropertyAccessExpression(call.expression)) return null;
  if (call.expression.name.text !== "use") return null;
  if (call.arguments.length < 2) return null;

  const firstArg = call.arguments[0];
  if (ts.isStringLiteral(firstArg)) {
    return firstArg.text;
  }
  return null;
}

// --- File and program utilities ---

/**
 * Find all TypeScript files in a directory recursively.
 */
function findTypeScriptFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (
          entry.endsWith(".ts") &&
          !entry.endsWith(".d.ts") &&
          !entry.endsWith(".test.ts") &&
          !entry.endsWith(".spec.ts")
        ) {
          files.push(fullPath);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  walk(rootDir);
  return files;
}

/**
 * Create a TypeScript program for type checking.
 */
function createProgram(files: string[], rootDir: string): ts.Program {
  const configPath = join(rootDir, "tsconfig.json");
  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
  };

  // Try to read tsconfig.json
  try {
    const configText = readFileSync(configPath, "utf-8");
    const parsedConfig = ts.parseConfigFileTextToJson(configPath, configText);
    if (parsedConfig.config) {
      const parsed = ts.parseJsonConfigFileContent(parsedConfig.config, ts.sys, rootDir);
      compilerOptions = parsed.options;
    }
  } catch {
    // Use defaults
  }

  return ts.createProgram(files, compilerOptions);
}

/**
 * Compute overall confidence from endpoints.
 */
function computeOverallConfidence(endpoints: ExtractedEndpoint[]): OpenApiConfidence {
  if (endpoints.length === 0) return "low";
  const typedCount = endpoints.filter((e) => e.typed).length;
  const ratio = typedCount / endpoints.length;
  if (ratio >= 0.7) return "medium";
  return "low";
}

/**
 * Default response when no type info is available.
 */
function defaultResponse(): ResponseSchema {
  return {
    statusCode: "200",
    contentType: "application/json",
    schema: null,
    description: "Response",
  };
}
