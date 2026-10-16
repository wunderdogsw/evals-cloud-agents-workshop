import Anthropic from "@anthropic-ai/sdk";
import { estimateCostUsd } from "./models.ts";

/**
 * Minimal structured-output helper: forces the model to call a single tool whose
 * input_schema is the shape you want back. Works with any current Claude model.
 */
export interface StructuredCall {
  model: string;
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  toolName?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface StructuredResult<T> {
  data: T;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  structured<T>(call: StructuredCall): Promise<StructuredResult<T>>;
}

let shared: LlmClient | undefined;

export function isMock(): boolean {
  return process.env.EVALS_MOCK === "1" || process.env.EVALS_MOCK === "true";
}

/** Swap the client (tests, mock mode, a gateway…). */
export function setLlmClient(client: LlmClient | undefined) {
  shared = client;
}

export function llm(): LlmClient {
  if (shared) return shared;
  if (!process.env.ANTHROPIC_API_KEY && !isMock()) {
    throw new Error("ANTHROPIC_API_KEY is not set. Put it in .env, or run with EVALS_MOCK=1 for offline fakes.");
  }
  shared = anthropicClient();
  return shared;
}

export function anthropicClient(client = new Anthropic()): LlmClient {
  return {
    async structured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
      const toolName = call.toolName ?? "submit";
      const res = await client.messages.create({
        model: call.model,
        max_tokens: call.maxTokens ?? 1024,
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
        ...(call.system ? { system: call.system } : {}),
        tools: [{ name: toolName, description: "Submit your answer.", input_schema: call.schema as any }],
        tool_choice: { type: "tool", name: toolName },
        messages: [{ role: "user", content: call.prompt }],
      });
      const block = res.content.find((b) => b.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error(`model did not call ${toolName}`);
      const inputTokens = res.usage.input_tokens;
      const outputTokens = res.usage.output_tokens;
      return { data: block.input as T, inputTokens, outputTokens, costUsd: estimateCostUsd(call.model, inputTokens, outputTokens) };
    },
  };
}
