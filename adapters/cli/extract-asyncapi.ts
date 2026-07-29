/**
 * CLI handler for `dt extract asyncapi`.
 * Outputs AsyncAPI extraction results in human-readable or JSON format.
 */

import { resolve } from "node:path";
import { extractTopics } from "#core/extract/asyncapi/topics.js";
import { extractPayloads } from "#core/extract/asyncapi/payloads.js";
import {
  validateAsyncApi,
  extractionResultToAsyncApiDocument,
} from "#core/extract/asyncapi/validate.js";
import type {
  AsyncApiChannel,
  AsyncApiConfidence,
  AsyncApiExtractionResult,
  AsyncApiOperation,
  UnresolvedEntry,
} from "#core/extract/asyncapi/types.js";
import { ExitCode } from "#core/exit-codes.js";

export interface ExtractAsyncApiOptions {
  json: boolean;
  targetDir?: string;
}

export interface ExtractAsyncApiOutput {
  result: AsyncApiExtractionResult | null;
  validation: { valid: boolean; errors: Array<{ path: string; message: string }> };
  message?: string;
}

/**
 * Run the extract asyncapi command.
 * Returns exit code.
 */
export function runExtractAsyncApi(options: ExtractAsyncApiOptions): number {
  const rootDir = resolve(options.targetDir ?? process.cwd());

  // Extract topics
  const topicResult = extractTopics(rootDir);

  // Extract payloads
  const payloadResult = extractPayloads(rootDir);

  // If no topics found, report and exit
  if (topicResult.topics.length === 0) {
    const output: ExtractAsyncApiOutput = {
      result: null,
      validation: { valid: false, errors: [] },
      message: "No Kafka topics could be extracted",
    };

    if (options.json) {
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    } else {
      process.stderr.write("No Kafka topics could be extracted.\n");
      process.stderr.write(
        "Ensure the repository uses kafkajs with producer.send/sendBatch or consumer.subscribe.\n",
      );
    }
    return ExitCode.Success;
  }

  // Build AsyncAPI extraction result
  const channels = buildChannels(topicResult.topics, payloadResult.payloads);
  const allUnresolved: UnresolvedEntry[] = [...topicResult.unresolved, ...payloadResult.unresolved];

  const overallConfidence = computeOverallConfidence(channels);

  const extractionResult: AsyncApiExtractionResult = {
    asyncapi: "2.6.0",
    info: { title: "Kafka Topics", version: "1.0.0" },
    channels,
    unresolved: allUnresolved,
    source: "inferred",
    confidence: overallConfidence,
  };

  // Validate the output
  const doc = extractionResultToAsyncApiDocument(extractionResult);
  const validation = validateAsyncApi(doc);

  const output: ExtractAsyncApiOutput = {
    result: extractionResult,
    validation,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    printHumanOutput(output);
  }

  return ExitCode.Success;
}

/**
 * Build channels from resolved topics and payloads.
 */
function buildChannels(
  topics: import("#core/extract/asyncapi/types.js").ResolvedTopic[],
  payloads: import("#core/extract/asyncapi/types.js").ResolvedPayload[],
): AsyncApiChannel[] {
  // Group topics by name
  const channelMap = new Map<string, AsyncApiChannel>();

  for (const topic of topics) {
    if (!channelMap.has(topic.name)) {
      channelMap.set(topic.name, { name: topic.name, operations: [] });
    }
    const channel = channelMap.get(topic.name)!;

    // Find matching payload
    const matchingPayload = payloads.find((p) => p.topic === topic.name);
    const payloadConfidence: AsyncApiConfidence = matchingPayload
      ? matchingPayload.payload_confidence
      : "low";
    const messageSchema = matchingPayload?.schema ?? null;

    const operation: AsyncApiOperation = {
      action: topic.direction === "provides" ? "send" : "receive",
      topic_confidence: topic.topic_confidence,
      payload_confidence: payloadConfidence,
      message_schema: messageSchema,
    };

    channel.operations.push(operation);
  }

  return Array.from(channelMap.values());
}

/**
 * Compute overall confidence from all channels.
 */
function computeOverallConfidence(channels: AsyncApiChannel[]): AsyncApiConfidence {
  if (channels.length === 0) return "low";

  let lowest: AsyncApiConfidence = "high";
  for (const channel of channels) {
    for (const op of channel.operations) {
      if (op.topic_confidence === "low" || op.payload_confidence === "low") return "low";
      if (op.topic_confidence === "medium" || op.payload_confidence === "medium") {
        lowest = "medium";
      }
    }
  }
  return lowest;
}

function printHumanOutput(output: ExtractAsyncApiOutput): void {
  const { result, validation } = output;

  if (!result) {
    process.stderr.write("No Kafka topics extracted.\n");
    return;
  }

  process.stdout.write("AsyncAPI Extraction Results\n");
  process.stdout.write("===========================\n\n");
  process.stdout.write(`Source: ${result.source}\n`);
  process.stdout.write(`Confidence: ${result.confidence}\n`);
  process.stdout.write(`Channels: ${result.channels.length}\n`);
  process.stdout.write(`Unresolved: ${result.unresolved.length}\n`);
  process.stdout.write(`Validation: ${validation.valid ? "PASS" : "FAIL"}\n\n`);

  process.stdout.write("Channels:\n");
  for (const channel of result.channels) {
    for (const op of channel.operations) {
      const direction = op.action === "send" ? "PRODUCES" : "CONSUMES";
      process.stdout.write(
        `  ${direction.padEnd(9)} ${channel.name} (topic: ${op.topic_confidence}, payload: ${op.payload_confidence})\n`,
      );
    }
  }

  if (result.unresolved.length > 0) {
    process.stdout.write("\nUnresolved:\n");
    for (const u of result.unresolved) {
      process.stdout.write(`  [${u.type}] ${u.file}:${u.line} — ${u.reason}\n`);
      process.stdout.write(`    ${u.snippet}\n`);
    }
  }

  if (!validation.valid) {
    process.stdout.write("\nValidation Errors:\n");
    for (const err of validation.errors) {
      process.stdout.write(`  ${err.path}: ${err.message}\n`);
    }
  }
}
