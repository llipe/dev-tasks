/**
 * LLM description pass for OpenAPI endpoints.
 * Writes only `summary`, `description`, `tags` per endpoint.
 * Does NOT modify structural information (paths, methods, params, schemas).
 */

import type { ExtractedEndpoint, OpenApiExtractionResult } from "./types.js";

/**
 * LLM provider interface for OpenAPI description generation.
 * Consumers provide an implementation; tests use stubs.
 */
export interface OpenApiLlmProvider {
  /**
   * Generate summary, description, and tags for a set of endpoints.
   * Must NOT modify structural fields (method, path, parameters, requestBody, responses).
   */
  describeEndpoints(endpoints: EndpointDescriptionInput[]): Promise<EndpointDescriptionOutput[]>;
}

/**
 * Input to the LLM for describing an endpoint.
 */
export interface EndpointDescriptionInput {
  method: string;
  path: string;
  parameters: string[];
  hasBody: boolean;
  responseType: string | null;
}

/**
 * LLM output: only descriptive fields.
 */
export interface EndpointDescriptionOutput {
  summary: string;
  description: string;
  tags: string[];
}

/**
 * Apply LLM-generated descriptions to an extraction result.
 * Only writes summary, description, and tags — nothing structural.
 */
export async function applyLlmDescriptions(
  result: OpenApiExtractionResult,
  llm: OpenApiLlmProvider,
): Promise<OpenApiExtractionResult> {
  const inputs: EndpointDescriptionInput[] = result.endpoints.map((ep) => ({
    method: ep.method,
    path: ep.path,
    parameters: ep.parameters.map((p) => `${p.name} (${p.in})`),
    hasBody: !!ep.requestBody,
    responseType: ep.responses[0]?.schema ? "typed" : null,
  }));

  const descriptions = await llm.describeEndpoints(inputs);

  // Apply descriptions to endpoints (do not modify structural fields)
  const updatedEndpoints: ExtractedEndpoint[] = result.endpoints.map((ep, i) => {
    const desc = descriptions[i];
    if (!desc) return ep;
    return {
      ...ep,
      summary: desc.summary,
      description: desc.description,
      tags: desc.tags,
    };
  });

  return {
    ...result,
    endpoints: updatedEndpoints,
  };
}
