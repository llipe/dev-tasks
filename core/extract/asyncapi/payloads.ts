/**
 * AsyncAPI payload classification.
 * Analyzes producer.send() calls to classify the message payload:
 *   - Typed send (generic or interface in the signature) → medium confidence, derive schema
 *   - Inline object literal built at call site → low, LLM infers shape
 *   - Opaque serialization (Buffer, JSON.stringify(variable)) → low + unresolved[]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { ResolvedPayload, UnresolvedEntry } from "./types.js";

/**
 * Result of payload extraction.
 */
export interface PayloadExtractionResult {
  payloads: ResolvedPayload[];
  unresolved: UnresolvedEntry[];
}

/**
 * Extract and classify Kafka message payloads from a repository.
 */
export function extractPayloads(rootDir: string): PayloadExtractionResult {
  const sourceFiles = findTypeScriptFiles(rootDir);
  const program = createProgram(sourceFiles, rootDir);
  const checker = program.getTypeChecker();

  const payloads: ResolvedPayload[] = [];
  const unresolved: UnresolvedEntry[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = sourceFile.fileName;
    if (filePath.includes("node_modules") || !filePath.startsWith(rootDir)) continue;

    const relPath = relative(rootDir, filePath);
    visitNode(sourceFile, relPath, checker, payloads, unresolved);
  }

  return { payloads, unresolved };
}

/**
 * Visit AST nodes to find producer.send calls and classify payloads.
 */
function visitNode(
  node: ts.Node,
  filePath: string,
  checker: ts.TypeChecker,
  payloads: ResolvedPayload[],
  unresolved: UnresolvedEntry[],
): void {
  if (ts.isCallExpression(node)) {
    handleSendCall(node, filePath, checker, payloads, unresolved);
  }

  ts.forEachChild(node, (child) => visitNode(child, filePath, checker, payloads, unresolved));
}

/**
 * Handle producer.send({ topic, messages }) to classify the payload.
 */
function handleSendCall(
  node: ts.CallExpression,
  filePath: string,
  checker: ts.TypeChecker,
  payloads: ResolvedPayload[],
  unresolved: UnresolvedEntry[],
): void {
  if (!ts.isPropertyAccessExpression(node.expression)) return;
  const methodName = node.expression.name.text;
  if (methodName !== "send") return;
  if (node.arguments.length < 1) return;

  const arg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return;

  // Confirm this is a kafkajs-style send (has topic + messages)
  const topicProp = findProperty(arg, "topic");
  const messagesProp = findProperty(arg, "messages");
  if (!topicProp || !messagesProp) return;

  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const topicName = resolveTopicName(topicProp);

  // Analyze the messages array for payload classification
  const messagesInit = getPropertyInitializer(messagesProp);
  if (!messagesInit) return;

  if (ts.isArrayLiteralExpression(messagesInit)) {
    for (const msgElement of messagesInit.elements) {
      if (!ts.isObjectLiteralExpression(msgElement)) continue;
      const valueProp = findProperty(msgElement, "value");
      if (!valueProp) continue;
      const valueInit = getPropertyInitializer(valueProp);
      if (!valueInit) continue;

      classifyPayload(
        valueInit,
        topicName,
        filePath,
        line + 1,
        checker,
        node,
        payloads,
        unresolved,
      );
    }
  }
}

/**
 * Classify a message value expression into typed/inline/opaque.
 */
function classifyPayload(
  valueExpr: ts.Expression,
  topic: string | null,
  filePath: string,
  line: number,
  checker: ts.TypeChecker,
  sendCallNode: ts.CallExpression,
  payloads: ResolvedPayload[],
  unresolved: UnresolvedEntry[],
): void {
  // Check for Buffer reference → opaque
  if (isBufferReference(valueExpr, checker)) {
    payloads.push({
      topic,
      source: "opaque",
      payload_confidence: "low",
      schema: null,
      file: filePath,
      line,
    });
    unresolved.push({
      file: filePath,
      line,
      reason: "Opaque payload: Buffer value, cannot derive schema",
      snippet: valueExpr.getText().slice(0, 100),
      type: "payload",
    });
    return;
  }

  // Check for JSON.stringify(X) calls
  if (ts.isCallExpression(valueExpr) && isJsonStringify(valueExpr)) {
    const innerArg = valueExpr.arguments[0];
    if (innerArg) {
      // Check if inner arg is an inline object literal → always classify as "inline"
      if (ts.isObjectLiteralExpression(innerArg)) {
        const inlineSchema = inferInlineObjectSchema(innerArg);
        payloads.push({
          topic,
          source: "inline",
          payload_confidence: "low",
          schema: inlineSchema,
          file: filePath,
          line,
        });
        return;
      }

      // Check if inner arg is a typed parameter/variable reference with a known interface
      if (ts.isIdentifier(innerArg) || ts.isPropertyAccessExpression(innerArg)) {
        const typedSchema = resolveTypedArgSchema(innerArg, checker);
        if (typedSchema) {
          payloads.push({
            topic,
            source: "typed",
            payload_confidence: "medium",
            schema: typedSchema,
            file: filePath,
            line,
          });
          return;
        }
      }

      // Otherwise opaque (untyped variable or complex expression)
      payloads.push({
        topic,
        source: "opaque",
        payload_confidence: "low",
        schema: null,
        file: filePath,
        line,
      });
      unresolved.push({
        file: filePath,
        line,
        reason: `Opaque payload: JSON.stringify with unresolvable type`,
        snippet: valueExpr.getText().slice(0, 100),
        type: "payload",
      });
      return;
    }
  }

  // Direct identifier/expression as value → check type
  if (ts.isIdentifier(valueExpr)) {
    const typedSchema = resolveTypedArgSchema(valueExpr, checker);
    if (typedSchema) {
      payloads.push({
        topic,
        source: "typed",
        payload_confidence: "medium",
        schema: typedSchema,
        file: filePath,
        line,
      });
      return;
    }

    // Opaque variable
    payloads.push({
      topic,
      source: "opaque",
      payload_confidence: "low",
      schema: null,
      file: filePath,
      line,
    });
    unresolved.push({
      file: filePath,
      line,
      reason: `Opaque payload: unresolvable variable type`,
      snippet: valueExpr.getText().slice(0, 100),
      type: "payload",
    });
    return;
  }

  // Inline object literal directly as value
  if (ts.isObjectLiteralExpression(valueExpr)) {
    const inlineSchema = inferInlineObjectSchema(valueExpr);
    payloads.push({
      topic,
      source: "inline",
      payload_confidence: "low",
      schema: inlineSchema,
      file: filePath,
      line,
    });
    return;
  }

  // Default: opaque
  payloads.push({
    topic,
    source: "opaque",
    payload_confidence: "low",
    schema: null,
    file: filePath,
    line,
  });
  unresolved.push({
    file: filePath,
    line,
    reason: `Opaque payload: cannot classify expression`,
    snippet: valueExpr.getText().slice(0, 100),
    type: "payload",
  });
}

/**
 * Check if an expression is a Buffer reference.
 */
function isBufferReference(expr: ts.Expression, checker: ts.TypeChecker): boolean {
  // Direct identifier named 'data' with Buffer type annotation
  if (ts.isIdentifier(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    if (symbol && symbol.valueDeclaration) {
      const decl = symbol.valueDeclaration;
      if (ts.isParameter(decl) && decl.type) {
        const typeText = decl.type.getText();
        if (typeText === "Buffer" || typeText === "Uint8Array") return true;
      }
    }
    // Also check the type from checker
    const type = checker.getTypeAtLocation(expr);
    const typeName = checker.typeToString(type);
    if (typeName === "Buffer" || typeName.includes("Buffer")) return true;
  }
  return false;
}

/**
 * Check if a call expression is JSON.stringify().
 */
function isJsonStringify(call: ts.CallExpression): boolean {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  const methodName = call.expression.name.text;
  if (methodName !== "stringify") return false;
  const obj = call.expression.expression;
  return ts.isIdentifier(obj) && obj.text === "JSON";
}

/**
 * Try to resolve a typed argument to a JSON Schema.
 * Works when the argument has an interface/type annotation.
 */
function resolveTypedArgSchema(
  expr: ts.Expression,
  checker: ts.TypeChecker,
): Record<string, unknown> | null {
  const type = checker.getTypeAtLocation(expr);
  const typeStr = checker.typeToString(type);

  // Skip 'any', 'unknown', primitive types
  if (typeStr === "any" || typeStr === "unknown" || typeStr === "never") return null;
  if (
    typeStr === "string" ||
    typeStr === "number" ||
    typeStr === "boolean" ||
    typeStr === "Buffer"
  ) {
    return null;
  }

  // Try to extract properties from the type
  const properties = type.getProperties();
  if (properties.length === 0) return null;

  const schema: Record<string, unknown> = { type: "object", properties: {} };
  const props: Record<string, unknown> = {};
  const required: string[] = [];

  for (const prop of properties) {
    const propType = checker.getTypeOfSymbol(prop);
    const propTypeStr = checker.typeToString(propType);
    props[prop.name] = { type: tsTypeToJsonSchemaType(propTypeStr) };
    if (!(prop.flags & ts.SymbolFlags.Optional)) {
      required.push(prop.name);
    }
  }

  schema.properties = props;
  if (required.length > 0) schema.required = required;
  return schema;
}

/**
 * Infer a schema from an inline object literal.
 */
function inferInlineObjectSchema(obj: ts.ObjectLiteralExpression): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const name = prop.name.text;
      const valueType = inferLiteralType(prop.initializer);
      properties[name] = { type: valueType };
    }
  }

  return { type: "object", properties };
}

/**
 * Infer the JSON Schema type of a literal expression.
 */
function inferLiteralType(expr: ts.Expression): string {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return "string";
  if (ts.isNumericLiteral(expr)) return "number";
  if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword)
    return "boolean";
  if (ts.isArrayLiteralExpression(expr)) return "array";
  if (ts.isObjectLiteralExpression(expr)) return "object";
  return "string";
}

/**
 * Map TypeScript type strings to JSON Schema types.
 */
function tsTypeToJsonSchemaType(tsType: string): string {
  if (tsType === "string") return "string";
  if (tsType === "number") return "number";
  if (tsType === "boolean") return "boolean";
  if (tsType.startsWith("Array") || tsType.endsWith("[]")) return "array";
  return "string";
}

/**
 * Resolve the topic name from a topic property (best-effort for payload association).
 */
function resolveTopicName(prop: ts.ObjectLiteralElementLike): string | null {
  const init = getPropertyInitializer(prop);
  if (!init) return null;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
    return init.text;
  }
  return null;
}

// --- Utility helpers ---

function findProperty(
  obj: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return obj.properties.find((p) => {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
      return p.name.text === name;
    }
    if (ts.isShorthandPropertyAssignment(p)) {
      return p.name.text === name;
    }
    return false;
  });
}

function getPropertyInitializer(prop: ts.ObjectLiteralElementLike): ts.Expression | undefined {
  if (ts.isPropertyAssignment(prop)) {
    return prop.initializer;
  }
  if (ts.isShorthandPropertyAssignment(prop)) {
    return prop.name as unknown as ts.Expression;
  }
  return undefined;
}

// --- File and program utilities ---

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
        // Skip unreadable
      }
    }
  }

  walk(rootDir);
  return files;
}

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
