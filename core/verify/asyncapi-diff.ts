/**
 * Custom AsyncAPI breaking-change comparator.
 *
 * Detects breaking changes between two AsyncAPI 2.x/3.x specifications.
 * No LLM or external dependencies.
 *
 * Breaking-change classes:
 * - Removed channel
 * - New required field in message payload
 * - Changed field type in message payload
 * - Narrowed enum (values removed)
 *
 * Non-breaking changes:
 * - New channel added
 * - New optional field in message payload
 * - Widened enum (values added)
 */

import type { DiffFinding, ContractDiffResult, PayloadConfidence } from "./types.js";

/**
 * Minimal AsyncAPI document shape for diffing.
 */
interface AsyncApiSpec {
  asyncapi?: string;
  channels?: Record<string, ChannelObject>;
}

interface ChannelObject {
  /** AsyncAPI 2.x: subscribe/publish operations */
  subscribe?: OperationObject;
  publish?: OperationObject;
  /** AsyncAPI 3.x: messages map */
  messages?: Record<string, MessageObject>;
  /** Metadata extension for payload confidence */
  "x-payload-confidence"?: PayloadConfidence;
}

interface OperationObject {
  message?: MessageObject | { oneOf?: MessageObject[] };
}

interface MessageObject {
  payload?: SchemaObject;
  /** Metadata extension for payload confidence */
  "x-payload-confidence"?: PayloadConfidence;
}

interface SchemaObject {
  type?: string;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SchemaObject>;
}

/**
 * Options for the AsyncAPI diff.
 */
export interface AsyncApiDiffOptions {
  /**
   * Skip channels/messages with this payload confidence or lower.
   * Default: skip "low" confidence payloads.
   */
  skipBelowConfidence?: PayloadConfidence;
}

/**
 * Compare two AsyncAPI specs and return diff findings.
 * Skips payloads with `payload_confidence: low` by default.
 */
export function diffAsyncApi(
  base: unknown,
  head: unknown,
  options: AsyncApiDiffOptions = {},
): ContractDiffResult {
  const findings: DiffFinding[] = [];
  const baseSpec = base as AsyncApiSpec;
  const headSpec = head as AsyncApiSpec;
  const skipBelow = options.skipBelowConfidence ?? "low";

  const baseChannels = baseSpec.channels ?? {};
  const headChannels = headSpec.channels ?? {};

  // Check removed channels
  for (const name of Object.keys(baseChannels)) {
    if (!(name in headChannels)) {
      findings.push({
        kind: "breaking",
        code: "channel-removed",
        message: `Channel '${name}' was removed`,
        path: `channels.${name}`,
      });
      continue;
    }

    // Channel exists in both — diff messages/operations
    const baseChannel = baseChannels[name];
    const headChannel = headChannels[name];
    diffChannel(name, baseChannel, headChannel, skipBelow, findings);
  }

  // Check added channels (non-breaking)
  for (const name of Object.keys(headChannels)) {
    if (!(name in baseChannels)) {
      findings.push({
        kind: "non-breaking",
        code: "channel-added",
        message: `Channel '${name}' was added`,
        path: `channels.${name}`,
      });
    }
  }

  return {
    contractType: "asyncapi",
    breaking: findings.some((f) => f.kind === "breaking"),
    findings,
  };
}

/**
 * Check if a confidence level should be skipped.
 */
function shouldSkip(
  confidence: PayloadConfidence | undefined,
  skipBelow: PayloadConfidence,
): boolean {
  if (!confidence) return false;
  if (skipBelow === "low") return confidence === "low";
  if (skipBelow === "medium") return confidence === "low" || confidence === "medium";
  return false;
}

function diffChannel(
  name: string,
  baseChannel: ChannelObject,
  headChannel: ChannelObject,
  skipBelow: PayloadConfidence,
  findings: DiffFinding[],
): void {
  // Skip entire channel if payload confidence is low
  if (shouldSkip(baseChannel["x-payload-confidence"], skipBelow)) return;
  if (shouldSkip(headChannel["x-payload-confidence"], skipBelow)) return;

  // AsyncAPI 2.x: subscribe/publish
  if (baseChannel.subscribe || headChannel.subscribe) {
    diffOperationMessages(
      `channels.${name}.subscribe`,
      getMessages(baseChannel.subscribe),
      getMessages(headChannel.subscribe),
      skipBelow,
      findings,
    );
  }

  if (baseChannel.publish || headChannel.publish) {
    diffOperationMessages(
      `channels.${name}.publish`,
      getMessages(baseChannel.publish),
      getMessages(headChannel.publish),
      skipBelow,
      findings,
    );
  }

  // AsyncAPI 3.x: messages map
  if (baseChannel.messages || headChannel.messages) {
    const baseMsgs = baseChannel.messages ?? {};
    const headMsgs = headChannel.messages ?? {};

    for (const msgName of Object.keys(baseMsgs)) {
      if (!(msgName in headMsgs)) continue; // message removal handled at channel level
      const baseMsg = baseMsgs[msgName];
      const headMsg = headMsgs[msgName];

      if (shouldSkip(baseMsg["x-payload-confidence"], skipBelow)) continue;
      if (shouldSkip(headMsg["x-payload-confidence"], skipBelow)) continue;

      if (baseMsg.payload && headMsg.payload) {
        diffSchema(
          `channels.${name}.messages.${msgName}.payload`,
          baseMsg.payload,
          headMsg.payload,
          findings,
        );
      }
    }
  }
}

function getMessages(op: OperationObject | undefined): MessageObject[] {
  if (!op?.message) return [];
  const msg = op.message;
  if ("oneOf" in msg && Array.isArray(msg.oneOf)) {
    return msg.oneOf;
  }
  return [msg as MessageObject];
}

function diffOperationMessages(
  path: string,
  baseMessages: MessageObject[],
  headMessages: MessageObject[],
  skipBelow: PayloadConfidence,
  findings: DiffFinding[],
): void {
  // Compare by index (positional) for simplicity
  const maxLen = Math.max(baseMessages.length, headMessages.length);
  for (let i = 0; i < maxLen; i++) {
    const baseMsg = baseMessages[i];
    const headMsg = headMessages[i];

    if (!baseMsg || !headMsg) continue;

    if (shouldSkip(baseMsg["x-payload-confidence"], skipBelow)) continue;
    if (shouldSkip(headMsg["x-payload-confidence"], skipBelow)) continue;

    if (baseMsg.payload && headMsg.payload) {
      diffSchema(`${path}.message[${i}].payload`, baseMsg.payload, headMsg.payload, findings);
    }
  }
}

function diffSchema(
  path: string,
  baseSchema: SchemaObject,
  headSchema: SchemaObject,
  findings: DiffFinding[],
): void {
  // Type change → breaking
  if (baseSchema.type && headSchema.type && baseSchema.type !== headSchema.type) {
    findings.push({
      kind: "breaking",
      code: "field-type-changed",
      message: `Field type changed from '${baseSchema.type}' to '${headSchema.type}'`,
      path: `${path}.type`,
    });
  }

  // Enum narrowing/widening
  diffEnum(path, baseSchema.enum, headSchema.enum, findings);

  // New required fields
  const baseRequired = new Set(baseSchema.required ?? []);
  const headRequired = new Set(headSchema.required ?? []);
  const baseProps = baseSchema.properties ?? {};
  const headProps = headSchema.properties ?? {};

  for (const field of headRequired) {
    if (!baseRequired.has(field) && !(field in baseProps)) {
      findings.push({
        kind: "breaking",
        code: "field-added-required",
        message: `New required field '${field}' added`,
        path: `${path}.properties.${field}`,
      });
    } else if (!baseRequired.has(field) && field in baseProps) {
      findings.push({
        kind: "breaking",
        code: "field-made-required",
        message: `Field '${field}' changed from optional to required`,
        path: `${path}.properties.${field}`,
      });
    }
  }

  // New optional fields → non-breaking
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

  // Recurse into shared properties
  for (const field of Object.keys(headProps)) {
    if (field in baseProps) {
      diffSchema(`${path}.properties.${field}`, baseProps[field], headProps[field], findings);
    }
  }
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
      path: `${path}.enum`,
    });
  }

  if (added.length > 0) {
    findings.push({
      kind: "non-breaking",
      code: "enum-widened",
      message: `Enum values added: ${added.join(", ")}`,
      path: `${path}.enum`,
    });
  }
}
