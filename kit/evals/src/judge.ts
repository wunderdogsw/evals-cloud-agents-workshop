import { isMock, llm } from "./llm.ts";
import { model } from "./models.ts";
import type { EvalCase, Grader, GradeResult } from "./types.ts";

export interface JudgeOptions<I = any, E = any, O = any> {
  /** Stable name — calibration and compare key off it. */
  name?: string;
  /**
   * The rubric. Write it like instructions to a strict senior reviewer:
   * what PASS means, what FAIL means, and the edge cases you care about.
   */
  rubric: string;
  /** Build what the judge sees. Default: input, expected (if any) and output as JSON. */
  render?: (c: EvalCase<I, E>, output: O) => string;
  model?: string;
  /** Include `expected` in what the judge sees. Default true. Turn off for reference-free judging. */
  showExpected?: boolean;
  /** Offline stand-in used when EVALS_MOCK=1. Default: pass. */
  mock?: (c: EvalCase<I, E>, output: O) => boolean;
}

const SYSTEM = `You are a strict, consistent evaluator. You grade one output against a rubric.
- Decide PASS or FAIL using only the rubric. Do not invent extra criteria.
- Reason briefly first, then decide. Cite the specific part of the output that drove your decision.
- If the rubric is ambiguous for this case, say so in your reasoning and FAIL.
- Score: 1.0 clear pass, 0.0 clear fail, values between only for partial credit the rubric explicitly allows.`;

const SCHEMA = {
  type: "object",
  properties: {
    reasoning: { type: "string", description: "2-4 sentences. Reason before deciding." },
    pass: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["reasoning", "pass", "score"],
};

function defaultRender(c: EvalCase, output: unknown, showExpected: boolean) {
  const parts = [`<input>\n${JSON.stringify(c.input, null, 2)}\n</input>`];
  if (showExpected && c.expected !== undefined) parts.push(`<reference>\n${JSON.stringify(c.expected, null, 2)}\n</reference>`);
  parts.push(`<output>\n${typeof output === "string" ? output : JSON.stringify(output, null, 2)}\n</output>`);
  return parts.join("\n\n");
}

export function llmJudge<I = any, E = any, O = any>(opts: JudgeOptions<I, E, O>): Grader<I, E, O> {
  const name = opts.name ?? "judge";
  return {
    name,
    async grade({ case: c, output }): Promise<GradeResult> {
      if (isMock()) {
        const pass = opts.mock ? opts.mock(c, output) : true;
        return { name, pass, score: pass ? 1 : 0, reason: "[mock judge]" };
      }
      const body = opts.render ? opts.render(c, output) : defaultRender(c as EvalCase, output, opts.showExpected ?? true);
      const prompt = `<rubric>\n${opts.rubric.trim()}\n</rubric>\n\n${body}\n\nGrade the output against the rubric.`;
      const res = await llm().structured<{ reasoning: string; pass: boolean; score: number }>({
        model: opts.model ?? model("judge"),
        system: SYSTEM,
        prompt,
        schema: SCHEMA,
        toolName: "submit_verdict",
        temperature: 0,
        maxTokens: 600,
      });
      const score = Math.max(0, Math.min(1, Number(res.data.score)));
      return { name, pass: Boolean(res.data.pass), score, reason: res.data.reasoning, costUsd: res.costUsd };
    },
  };
}
