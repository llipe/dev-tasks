/**
 * AsyncAPI structural validation.
 * Validates the extraction output against the AsyncAPI specification structure.
 * Supports AsyncAPI 2.x and 3.x structural validation.
 */

import type { AsyncApiDocument, AsyncApiExtractionResult } from "./types.js";

/**
 * Validation result.
 */
export interface AsyncApiValidationResult {
  valid: boolean;
  errors: AsyncApiValidationError[];
}

/**
 * A single validation error.
 */
export interface AsyncApiValidationError {
  path: string;
  message: string;
}

/**
 * Validate an AsyncAPI document against the AsyncAPI specification structure.
 */
export function validateAsyncApi(doc: AsyncApiDocument): AsyncApiValidationResult {
  const errors: AsyncApiValidationError[] = [];

  // Required: asyncapi field
  if (!doc.asyncapi) {
    errors.push({ path: "/asyncapi", message: "Missing required field 'asyncapi'" });
  } else if (typeof doc.asyncapi !== "string") {
    errors.push({ path: "/asyncapi", message: "'asyncapi' must be a string" });
  } else if (!doc.asyncapi.startsWith("2.") && !doc.asyncapi.startsWith("3.")) {
    errors.push({
      path: "/asyncapi",
      message: `'asyncapi' must be 2.x or 3.x, got '${doc.asyncapi}'`,
    });
  }

  // Required: info field
  if (!doc.info) {
    errors.push({ path: "/info", message: "Missing required field 'info'" });
  } else {
    if (!doc.info.title || typeof doc.info.title !== "string") {
      errors.push({ path: "/info/title", message: "Missing or invalid 'info.title'" });
    }
    if (!doc.info.version || typeof doc.info.version !== "string") {
      errors.push({ path: "/info/version", message: "Missing or invalid 'info.version'" });
    }
  }

  // Required: channels field
  if (!doc.channels) {
    errors.push({ path: "/channels", message: "Missing required field 'channels'" });
  } else if (typeof doc.channels !== "object") {
    errors.push({ path: "/channels", message: "'channels' must be an object" });
  } else {
    validateChannels(doc.asyncapi, doc.channels as Record<string, Record<string, unknown>>, errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the channels object.
 */
function validateChannels(
  version: string,
  channels: Record<string, Record<string, unknown>>,
  errors: AsyncApiValidationError[],
): void {
  for (const [channelName, channelItem] of Object.entries(channels)) {
    if (!channelItem || typeof channelItem !== "object") {
      errors.push({
        path: `/channels/${channelName}`,
        message: `Channel '${channelName}' must be an object`,
      });
      continue;
    }

    if (version.startsWith("2.")) {
      // AsyncAPI 2.x: channels have publish/subscribe operations
      validateChannel2x(channelName, channelItem as Record<string, unknown>, errors);
    } else if (version.startsWith("3.")) {
      // AsyncAPI 3.x: channels define address/messages, operations are separate
      validateChannel3x(channelName, channelItem as Record<string, unknown>, errors);
    }
  }
}

/**
 * Validate a channel in AsyncAPI 2.x format.
 */
function validateChannel2x(
  channelName: string,
  channel: Record<string, unknown>,
  errors: AsyncApiValidationError[],
): void {
  // At least one of publish/subscribe should be present (non-fatal if both missing — just empty)
  const hasPublish = "publish" in channel;
  const hasSubscribe = "subscribe" in channel;

  if (hasPublish && channel.publish && typeof channel.publish !== "object") {
    errors.push({
      path: `/channels/${channelName}/publish`,
      message: "'publish' must be an object",
    });
  }

  if (hasSubscribe && channel.subscribe && typeof channel.subscribe !== "object") {
    errors.push({
      path: `/channels/${channelName}/subscribe`,
      message: "'subscribe' must be an object",
    });
  }
}

/**
 * Validate a channel in AsyncAPI 3.x format.
 */
function validateChannel3x(
  channelName: string,
  channel: Record<string, unknown>,
  errors: AsyncApiValidationError[],
): void {
  // 3.x channels have address and messages
  if (channel.address !== undefined && typeof channel.address !== "string") {
    errors.push({
      path: `/channels/${channelName}/address`,
      message: "'address' must be a string",
    });
  }
}

/**
 * Convert an AsyncApiExtractionResult to a standard AsyncAPI 2.6 document for validation.
 */
export function extractionResultToAsyncApiDocument(
  result: AsyncApiExtractionResult,
): AsyncApiDocument {
  const channels: Record<string, unknown> = {};

  for (const channel of result.channels) {
    const channelObj: Record<string, unknown> = {};

    // Separate operations into publish (send) and subscribe (receive)
    const publishOps = channel.operations.filter((op) => op.action === "send");
    const subscribeOps = channel.operations.filter((op) => op.action === "receive");

    if (publishOps.length > 0) {
      const firstOp = publishOps[0];
      const publishDef: Record<string, unknown> = {
        operationId: `publish_${sanitizeName(channel.name)}`,
        "x-topic-confidence": firstOp.topic_confidence,
        "x-payload-confidence": firstOp.payload_confidence,
      };
      if (firstOp.message_schema) {
        publishDef.message = { payload: firstOp.message_schema };
      } else {
        publishDef.message = { payload: { type: "object" } };
      }
      channelObj.publish = publishDef;
    }

    if (subscribeOps.length > 0) {
      const firstOp = subscribeOps[0];
      const subscribeDef: Record<string, unknown> = {
        operationId: `subscribe_${sanitizeName(channel.name)}`,
        "x-topic-confidence": firstOp.topic_confidence,
        "x-payload-confidence": firstOp.payload_confidence,
      };
      if (firstOp.message_schema) {
        subscribeDef.message = { payload: firstOp.message_schema };
      } else {
        subscribeDef.message = { payload: { type: "object" } };
      }
      channelObj.subscribe = subscribeDef;
    }

    channels[channel.name] = channelObj;
  }

  return {
    asyncapi: result.asyncapi,
    info: result.info,
    channels,
  };
}

/**
 * Sanitize a channel name for use as an operationId.
 */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
