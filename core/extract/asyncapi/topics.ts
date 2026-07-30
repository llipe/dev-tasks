/**
 * AsyncAPI topic extraction via AST over kafkajs.
 * Detects:
 *   - producer.send({ topic: X, messages }) → provides
 *   - producer.sendBatch({ topicMessages: [...] }) → provides
 *   - consumer.subscribe({ topic: X }) → consumes
 *   - consumer.subscribe({ topics: [X, Y] }) → consumes
 *
 * Topic resolution with confidence:
 *   - String literal → high
 *   - Module constant or enum (follow reference in AST) → high
 *   - Template literal with env var → medium (record pattern + variable)
 *   - Unresolvable expression → low + entry in unresolved[]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { ResolvedTopic, UnresolvedEntry } from "./types.js";

/**
 * Result of topic extraction.
 */
export interface TopicExtractionResult {
  topics: ResolvedTopic[];
  unresolved: UnresolvedEntry[];
}

/**
 * Extract Kafka topics from a repository using AST analysis.
 */
export function extractTopics(rootDir: string): TopicExtractionResult {
  const sourceFiles = findTypeScriptFiles(rootDir);
  const program = createProgram(sourceFiles, rootDir);
  const checker = program.getTypeChecker();

  const topics: ResolvedTopic[] = [];
  const unresolved: UnresolvedEntry[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = sourceFile.fileName;
    if (filePath.includes("node_modules") || !filePath.startsWith(rootDir)) continue;

    const relPath = relative(rootDir, filePath);
    visitNode(sourceFile, relPath, checker, topics, unresolved);
  }

  return { topics, unresolved };
}

/**
 * Visit AST nodes to find kafkajs producer/consumer calls.
 */
function visitNode(
  node: ts.Node,
  filePath: string,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  if (ts.isCallExpression(node)) {
    handleCallExpression(node, filePath, checker, topics, unresolved);
  }

  ts.forEachChild(node, (child) => visitNode(child, filePath, checker, topics, unresolved));
}

/**
 * Handle a call expression — detect send/sendBatch/subscribe patterns.
 */
function handleCallExpression(
  node: ts.CallExpression,
  filePath: string,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  if (!ts.isPropertyAccessExpression(node.expression)) return;

  const methodName = node.expression.name.text;

  if (methodName === "send") {
    handleProducerSend(node, filePath, checker, topics, unresolved);
  } else if (methodName === "sendBatch") {
    handleProducerSendBatch(node, filePath, checker, topics, unresolved);
  } else if (methodName === "subscribe") {
    handleConsumerSubscribe(node, filePath, checker, topics, unresolved);
  }
}

/**
 * Handle producer.send({ topic: X, messages: [...] }) pattern.
 */
function handleProducerSend(
  node: ts.CallExpression,
  filePath: string,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  if (node.arguments.length < 1) return;
  const arg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return;

  // Look for a 'topic' property with a 'messages' sibling (to confirm kafkajs pattern)
  const topicProp = findProperty(arg, "topic");
  const messagesProp = findProperty(arg, "messages");
  if (!topicProp || !messagesProp) return;

  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  resolveTopic(topicProp, "provides", filePath, line + 1, checker, topics, unresolved);
}

/**
 * Handle producer.sendBatch({ topicMessages: [...] }) pattern.
 * Each item in topicMessages has { topic: X, messages: [...] }.
 */
function handleProducerSendBatch(
  node: ts.CallExpression,
  filePath: string,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  if (node.arguments.length < 1) return;
  const arg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return;

  const topicMessagesProp = findProperty(arg, "topicMessages");
  if (!topicMessagesProp) return;

  const initializer = getPropertyInitializer(topicMessagesProp);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) return;

  const sourceFile = node.getSourceFile();

  for (const element of initializer.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;
    const topicProp = findProperty(element, "topic");
    if (!topicProp) continue;

    const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart());
    resolveTopic(topicProp, "provides", filePath, line + 1, checker, topics, unresolved);
  }
}

/**
 * Handle consumer.subscribe({ topic: X }) or consumer.subscribe({ topics: [X, Y] }).
 */
function handleConsumerSubscribe(
  node: ts.CallExpression,
  filePath: string,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  if (node.arguments.length < 1) return;
  const arg = node.arguments[0];
  if (!ts.isObjectLiteralExpression(arg)) return;

  const sourceFile = node.getSourceFile();
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  // Check for single topic: { topic: X }
  const topicProp = findProperty(arg, "topic");
  if (topicProp) {
    resolveTopic(topicProp, "consumes", filePath, line + 1, checker, topics, unresolved);
    return;
  }

  // Check for multiple topics: { topics: [X, Y] }
  const topicsProp = findProperty(arg, "topics");
  if (topicsProp) {
    const initializer = getPropertyInitializer(topicsProp);
    if (initializer && ts.isArrayLiteralExpression(initializer)) {
      for (const element of initializer.elements) {
        resolveTopicExpression(
          element,
          "consumes",
          filePath,
          line + 1,
          checker,
          topics,
          unresolved,
        );
      }
    }
  }
}

/**
 * Resolve a topic property assignment to a ResolvedTopic or UnresolvedEntry.
 */
function resolveTopic(
  prop: ts.ObjectLiteralElementLike,
  direction: "provides" | "consumes",
  filePath: string,
  line: number,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  const initializer = getPropertyInitializer(prop);
  if (!initializer) return;

  resolveTopicExpression(initializer, direction, filePath, line, checker, topics, unresolved);
}

/**
 * Resolve a topic expression (the value part) to determine confidence.
 */
function resolveTopicExpression(
  expr: ts.Expression,
  direction: "provides" | "consumes",
  filePath: string,
  line: number,
  checker: ts.TypeChecker,
  topics: ResolvedTopic[],
  unresolved: UnresolvedEntry[],
): void {
  // 1. String literal → high
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    topics.push({
      name: expr.text,
      direction,
      resolution: "literal",
      topic_confidence: "high",
      file: filePath,
      line,
    });
    return;
  }

  // 2. Template literal → medium (record pattern + variables)
  if (ts.isTemplateExpression(expr)) {
    const { pattern, variables } = extractTemplateInfo(expr);
    topics.push({
      name: pattern,
      direction,
      resolution: "template",
      topic_confidence: "medium",
      file: filePath,
      line,
      pattern,
      variables,
    });
    return;
  }

  // 3. Identifier or property access — try to resolve to a constant/enum value
  if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
    const resolved = resolveConstantValue(expr, checker);
    if (resolved !== null) {
      topics.push({
        name: resolved,
        direction,
        resolution: "constant",
        topic_confidence: "high",
        file: filePath,
        line,
      });
      return;
    }
  }

  // 4. Unresolvable → low + unresolved entry
  const snippet = expr.getText().slice(0, 100);
  topics.push({
    name: `<unresolved:${snippet}>`,
    direction,
    resolution: "unresolvable",
    topic_confidence: "low",
    file: filePath,
    line,
  });
  unresolved.push({
    file: filePath,
    line,
    reason: `Topic expression is unresolvable: ${snippet}`,
    snippet,
    type: "topic",
  });
}

/**
 * Extract pattern and variable names from a template literal expression.
 */
function extractTemplateInfo(expr: ts.TemplateExpression): {
  pattern: string;
  variables: string[];
} {
  const variables: string[] = [];
  let pattern = expr.head.text;

  for (const span of expr.templateSpans) {
    const varName = extractVariableName(span.expression);
    variables.push(varName);
    pattern += `\${${varName}}`;
    pattern += span.literal.text;
  }

  return { pattern, variables };
}

/**
 * Extract a human-readable variable name from an expression.
 */
function extractVariableName(expr: ts.Expression): string {
  if (ts.isIdentifier(expr)) {
    return expr.text;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    // e.g., process.env.TOPIC_PREFIX
    const parts: string[] = [];
    let current: ts.Expression = expr;
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.text);
      current = current.expression;
    }
    if (ts.isIdentifier(current)) {
      parts.unshift(current.text);
    }
    return parts.join(".");
  }
  return expr.getText().slice(0, 50);
}

/**
 * Try to resolve an identifier or property access to a constant string value.
 * Follows references through the type checker to find initializer values.
 */
function resolveConstantValue(expr: ts.Expression, checker: ts.TypeChecker): string | null {
  const symbol = checker.getSymbolAtLocation(expr);
  if (!symbol) return null;

  // Follow aliases (imports)
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

  // Check for enum members
  if (resolved.flags & ts.SymbolFlags.EnumMember) {
    const decl = resolved.valueDeclaration;
    if (decl && ts.isEnumMember(decl) && decl.initializer && ts.isStringLiteral(decl.initializer)) {
      return decl.initializer.text;
    }
    // Try constant value from type checker
    const constValue = checker.getConstantValue(decl as ts.EnumMember);
    if (typeof constValue === "string") return constValue;
  }

  // Check for const variable with string literal initializer
  if (resolved.flags & ts.SymbolFlags.Variable) {
    const decl = resolved.valueDeclaration;
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      if (ts.isStringLiteral(decl.initializer)) {
        return decl.initializer.text;
      }
    }
  }

  return null;
}

// --- Utility helpers ---

/**
 * Find a named property in an object literal expression.
 */
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

/**
 * Get the initializer expression of a property assignment.
 */
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
