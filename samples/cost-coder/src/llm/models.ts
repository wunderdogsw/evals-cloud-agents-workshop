// Copied from the workshop kit (kit/evals/src/models.ts) so this sample stands alone. Keep in sync.
/**
 * Default model IDs used across the workshop. Verified against
 * https://platform.claude.com/docs/en/models/overview (October 2026).
 * Override per machine with env vars or `.workshop/facilitator.json`.
 */
export const DEFAULT_MODELS = {
  /** The feature under test (cheap + fast). */
  task: "claude-haiku-5-5",
  /** LLM-as-judge. Cheap is fine once calibrated; bump if agreement is poor. */
  judge: "claude-haiku-5-5",
  /** Coding agents in Phase 6+. */
  agent: "claude-sonnet-5-5",
} as const;

export function model(role: keyof typeof DEFAULT_MODELS): string {
  const env = {
    task: process.env.EVAL_TASK_MODEL,
    judge: process.env.EVAL_JUDGE_MODEL,
    agent: process.env.EVAL_AGENT_MODEL,
  }[role];
  return env && env.length > 0 ? env : DEFAULT_MODELS[role];
}

/** Rough USD per million tokens (input, output) for cost reporting. Update if prices change. */
export const PRICES_PER_MTOK: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES_PER_MTOK[modelId];
  if (!p) return 0;
  return (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000;
}
