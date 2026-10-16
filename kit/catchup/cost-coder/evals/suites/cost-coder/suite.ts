import { custom, defineSuite, hasShape, llmJudge } from "../../runner/index.ts";
import { readFileSync } from "node:fs";
import { classifyLine } from "__CLASSIFY_IMPORT__";

const rubric = readFileSync(new URL("./rubric.md", import.meta.url), "utf8");

export default defineSuite({
  name: "cost-coder",
  cases: "./cases.jsonl",
  task: (input: any) => classifyLine(input),
  graders: [
    hasShape({ costCode: "string", confidence: "number", rationale: "string" }),
    custom("cost-code", ({ case: c, output }: any) => {
      const ok = [c.expected.costCode, ...(c.expected.acceptable ?? [])];
      return { pass: ok.includes(output.costCode), reason: `got ${output.costCode}, accept ${ok.join("/")}` };
    }),
    llmJudge({
      name: "judge",
      rubric,
      showExpected: false,
      render: (c: any, o: any) => `<invoice_line>\n${JSON.stringify(c.input)}\n</invoice_line>\n\n<cost_code>${o.costCode}</cost_code>\n<rationale>\n${o.rationale}\n</rationale>`,
      mock: (_c: any, o: any) => o.rationale.length > 0,
    }),
  ],
  threshold: { passRate: 0.7, graders: { "cost-code": 0.85 } },
});
