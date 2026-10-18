import { test } from "node:test";
import assert from "node:assert/strict";
import { type CaseContext, type EvalCase, gradeCase, outsideAllowed, resultEvent, toolUses } from "./eval-build-phase.ts";
import type { DocResult } from "./lint-phases.ts";

const doc = (over: Partial<DocResult> = {}): DocResult => ({
  file: ".agents/phases/11-DISCOVER.md",
  phase: 11,
  title: "Discover your agent setup",
  legacy: false,
  errors: [],
  commands: [],
  ...over,
});
const build: EvalCase = { id: "b", request: "x", expect: "build", phase: 11 };
const refuse: EvalCase = { id: "r", request: "x", expect: "refuse" };
const ctx = (over: Partial<CaseContext> = {}): CaseContext => ({
  changed: [".agents/phases/11-DISCOVER.md", "AGENTS.md"],
  docs: [doc()],
  repoErrors: [],
  uses: [],
  ...over,
});
const failed = (checks: { name: string; pass: boolean | null }[]) => checks.filter((c) => c.pass === false).map((c) => c.name);

test("a clean build passes every check", () => {
  assert.deepEqual(failed(gradeCase(build, ctx())), []);
});

test("a missing or invalid phase doc fails", () => {
  assert.deepEqual(failed(gradeCase(build, ctx({ docs: [] }))), ["phase-doc"]);
  assert.deepEqual(failed(gradeCase(build, ctx({ docs: [doc({ errors: ["bad"] })] }))), ["phase-doc"]);
  assert.deepEqual(failed(gradeCase(build, ctx({ docs: [doc({ legacy: true })] }))), ["phase-doc"]);
});

test("phase map disagreements fail", () => {
  assert.deepEqual(failed(gradeCase(build, ctx({ repoErrors: ["count"] }))), ["phase-map"]);
});

test("changing files outside the phase files fails", () => {
  assert.deepEqual(failed(gradeCase(build, ctx({ changed: ["AGENTS.md", "kit/evals/src/cli.ts"] }))), ["stays-in-scope"]);
  assert.deepEqual(outsideAllowed([".agents/phases/02-X.md", ".agents/PLAN.md", ".agents/assets/workshop.ts", "README.md"]), ["README.md"]);
});

test("mentioning slash commands requires fetching the Claude Code docs", () => {
  const withCmd = [doc({ commands: ["/doctor"] })];
  assert.deepEqual(failed(gradeCase(build, ctx({ docs: withCmd, uses: [{ name: "Read", input: {} }] }))), ["docs-checked"]);
  const fetched = [{ name: "WebFetch", input: { url: "https://code.claude.com/docs/en/commands" } }];
  assert.deepEqual(failed(gradeCase(build, ctx({ docs: withCmd, uses: fetched }))), []);
  const unknown = gradeCase(build, ctx({ docs: withCmd, uses: null })).find((c) => c.name === "docs-checked");
  assert.equal(unknown?.pass, null);
});

test("an out-of-scope request passes only when nothing changed", () => {
  assert.deepEqual(failed(gradeCase(refuse, ctx({ changed: [] }))), []);
  assert.deepEqual(failed(gradeCase(refuse, ctx())), ["no-changes"]);
});

test("tool calls and the result are read from stream-json output", () => {
  const stream = [
    JSON.stringify({ type: "system", subtype: "init" }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }, { type: "tool_use", name: "WebFetch", input: { url: "u" } }] } }),
    JSON.stringify({ type: "result", subtype: "success", total_cost_usd: 0.5, num_turns: 3, result: "done" }),
  ].join("\n");
  assert.deepEqual(toolUses(stream), [{ name: "WebFetch", input: { url: "u" } }]);
  assert.equal(resultEvent(stream).total_cost_usd, 0.5);
});
