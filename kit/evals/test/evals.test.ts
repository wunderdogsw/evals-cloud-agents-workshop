import { afterEach, describe, expect, it } from "vitest";
import {
  calibrate,
  compareRuns,
  defineSuite,
  exactMatch,
  hasShape,
  includes,
  llmJudge,
  oneOf,
  parseJsonl,
  runSuite,
  setLlmClient,
  shellTask,
  toJUnit,
  type EvalCase,
} from "../src/index.ts";

const cases: EvalCase<{ q: string }, { a: string }>[] = [
  { id: "c1", input: { q: "one" }, expected: { a: "1" }, tags: ["easy"] },
  { id: "c2", input: { q: "two" }, expected: { a: "2" }, tags: ["easy"] },
  { id: "c3", input: { q: "three" }, expected: { a: "3" }, tags: ["hard"] },
  { id: "c4", input: { q: "four" }, expected: { a: "4" }, tags: ["hard"] },
];
const answers: Record<string, string> = { one: "1", two: "2", three: "3", four: "4" };

afterEach(() => setLlmClient(undefined));

describe("graders", () => {
  it("exactMatch is case-insensitive and trims", async () => {
    const g = exactMatch("a");
    expect((await g.grade({ case: cases[0]!, output: { a: " 1 " } })).pass).toBe(true);
    expect((await g.grade({ case: cases[0]!, output: { a: "2" } })).pass).toBe(false);
  });
  it("oneOf accepts any listed answer", async () => {
    const g = oneOf("code", "codes");
    const c = { id: "x", input: {}, expected: { codes: ["A", "B"] } };
    expect((await g.grade({ case: c, output: { code: "b" } })).pass).toBe(true);
    expect((await g.grade({ case: c, output: { code: "C" } })).pass).toBe(false);
  });
  it("includes gives partial credit", async () => {
    const r = await includes("t", ["foo", "bar"]).grade({ case: cases[0]!, output: { t: "foo only" } });
    expect(r.score).toBe(0.5);
    expect(r.pass).toBe(false);
  });
  it("hasShape reports type problems", async () => {
    const r = await hasShape({ a: "string", n: "number" }).grade({ case: cases[0]!, output: { a: "x", n: "1" } });
    expect(r.pass).toBe(false);
    expect(r.reason).toContain("n: want number");
  });
});

describe("runner", () => {
  const suite = (wrong: string[] = []) =>
    defineSuite({
      name: "toy",
      cases,
      task: async ({ q }: { q: string }) => ({ a: wrong.includes(q) ? "x" : answers[q]! }),
      graders: [exactMatch("a")],
      threshold: { passRate: 0.75 },
    });

  it("computes pass rate, tags and threshold", async () => {
    const r = await runSuite(suite(["four"]));
    expect(r.summary.passRate).toBe(0.75);
    expect(r.summary.byTag.hard!.passRate).toBe(0.5);
    expect(r.summary.thresholdMet).toBe(true);
    const r2 = await runSuite(suite(["three", "four"]));
    expect(r2.summary.thresholdMet).toBe(false);
  });

  it("records task errors without crashing the run", async () => {
    const r = await runSuite(
      defineSuite({ name: "boom", cases, task: async ({ q }: { q: string }) => { if (q === "two") throw new Error("kaboom"); return { a: answers[q] }; }, graders: [exactMatch("a")] }),
    );
    expect(r.summary.errors).toBe(1);
    expect(r.runs.find((x) => x.caseId === "c2")!.error).toBe("kaboom");
  });

  it("filters by tag and runs trials", async () => {
    const r = await runSuite(suite(), { tags: ["hard"], trials: 3 });
    expect(r.runs).toHaveLength(6);
    expect(r.summary.cases).toBe(2);
  });

  it("compare finds regressions even when pass rate is unchanged", async () => {
    const before = await runSuite(suite(["four"]), { label: "v1" });
    const after = await runSuite(suite(["one"]), { label: "v2" });
    const c = compareRuns(before, after);
    expect(c.before.passRate).toBe(c.after.passRate);
    expect(c.regressions.map((r) => r.caseId)).toEqual(["c1"]);
    expect(c.fixes.map((r) => r.caseId)).toEqual(["c4"]);
  });

  it("emits JUnit with failures", async () => {
    const xml = toJUnit(await runSuite(suite(["four"])));
    expect(xml).toContain('tests="4" failures="1"');
    expect(xml).toContain("<failure");
  });
});

describe("judge + calibration", () => {
  it("uses the structured client and calibrates against labels", async () => {
    setLlmClient({
      async structured<T>() {
        return { data: { reasoning: "ok", pass: true, score: 1 } as T, costUsd: 0.001, inputTokens: 10, outputTokens: 5 };
      },
    });
    const run = await runSuite(defineSuite({ name: "j", cases, task: async ({ q }: { q: string }) => answers[q], graders: [llmJudge({ rubric: "be nice" })] }));
    expect(run.summary.passRate).toBe(1);
    expect(run.summary.totalCostUsd).toBeCloseTo(0.004);
    const cal = calibrate(run, "judge", [
      { id: "c1", pass: true },
      { id: "c2", pass: true },
      { id: "c3", pass: false },
      { id: "c4", pass: true },
    ]);
    expect(cal.agreement).toBe(0.75);
    expect(cal.falsePass).toBe(1);
    expect(cal.disagreements[0]!.id).toBe("c3");
  });
});

describe("dataset + shellTask", () => {
  it("rejects duplicate ids", () => {
    expect(() => parseJsonl('{"id":"a","input":1}\n{"id":"a","input":2}')).toThrow(/duplicate/);
  });
  it("skips comments and blank lines", () => {
    expect(parseJsonl('// hi\n\n{"id":"a","input":1}\n')).toHaveLength(1);
  });
  it("shellTask pipes JSON through a process", async () => {
    const t = shellTask<{ n: number }, { n: number }>(`node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(JSON.stringify({n:o.n*2}))})"`);
    expect(await t({ n: 21 }, { caseId: "x", trial: 1 })).toEqual({ n: 42 });
  });
});

describe("tag thresholds and regrade", () => {
  const tagged = cases.map((c) => (c.id === "c3" ? { ...c, tags: ["hard", "critical"] } : c));
  const s = (wrong: string[]) =>
    defineSuite({
      name: "tags",
      cases: tagged,
      task: async ({ q }: { q: string }) => ({ a: wrong.includes(q) ? "x" : answers[q]! }),
      graders: [exactMatch("a")],
      threshold: { passRate: 0.5, tags: { critical: 1 } },
    });

  it("fails when a critical case fails, even if pass rate is fine", async () => {
    const r = await runSuite(s(["three"]));
    expect(r.summary.passRate).toBe(0.75);
    expect(r.summary.thresholdMet).toBe(false);
    expect(r.summary.thresholdFailures!.join()).toContain("c3");
  });

  it("re-grades stored outputs without calling the task", async () => {
    const first = await runSuite(s([]));
    let calls = 0;
    const strict = defineSuite({ ...s([]), task: async () => { calls++; return { a: "never" }; }, graders: [exactMatch("a"), hasShape({ a: "string" })] });
    const reuse = new Map(first.runs.map((r) => [`${r.caseId}#${r.trial}`, { output: r.output }]));
    const again = await runSuite(strict, { reuseOutputs: reuse });
    expect(calls).toBe(0);
    expect(again.summary.passRate).toBe(1);
    expect(again.summary.graders.map((g) => g.name)).toEqual(["exact:a", "shape"]);
  });
});

describe("providers", () => {
  it("extracts JSON from Cursor-style free text", async () => {
    const { extractJsonObject } = await import("../src/llm.ts");
    expect(extractJsonObject('Sure! ```json\n{"pass": true, "reasoning": "a } inside"}\n```')).toEqual({ pass: true, reasoning: "a } inside" });
    expect(extractJsonObject('{"a":{"b":1}} trailing')).toEqual({ a: { b: 1 } });
  });

  it("claude-code client passes schema and model and reads structured_output", async () => {
    const { mkdtemp, writeFile, readFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "cc-"));
    const argsFile = join(dir, "args.json");
    const bin = join(dir, "claude");
    await writeFile(bin, `#!/usr/bin/env node\nrequire("fs").writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\nconsole.log(JSON.stringify({type:"result",subtype:"success",is_error:false,structured_output:{pass:true,score:1,reasoning:"ok"},total_cost_usd:0.002,usage:{input_tokens:10,output_tokens:3}}));\n`, { mode: 0o755 });
    const { claudeCodeClient } = await import("../src/llm.ts");
    const r = await claudeCodeClient(bin).structured<{ pass: boolean }>({ model: "claude-haiku-5-5", prompt: "judge `this` $now", schema: { type: "object" }, system: "be strict" });
    const argv = JSON.parse(await readFile(argsFile, "utf8"));
    expect(r.data.pass).toBe(true);
    expect(r.costUsd).toBe(0.002);
    expect(argv[1]).toBe("judge `this` $now");
    expect(argv).toContain("--json-schema");
    expect(argv[argv.indexOf("--tools") + 1]).toBe("");
    expect(argv[argv.indexOf("--model") + 1]).toBe("claude-haiku-5-5");
  });
});
