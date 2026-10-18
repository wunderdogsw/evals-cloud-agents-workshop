import { test } from "node:test";
import assert from "node:assert/strict";
import { countSentences, findCommands, lintPhaseDoc, parsePhaseMap } from "./lint-phases.ts";

const GOOD = `# Phase 1 — Discover your agent setup

## What you do

1. **Find the agent files** — List \`CLAUDE.md\`, \`AGENTS.md\`, skills, subagents, hooks and MCP config in your repo.
2. **Inspect them in Claude Code** — Run \`/memory\`, \`/skills\` and \`/hooks\` and note what loads.
3. **Mark their status** — Mark each file present, missing or out of date.

## Gate

- [ ] \`agent-inventory.md\` lists every file type with its status
- [ ] You can name the one missing or out-of-date file that hurts most

## Learning point

Agent files are the spec your agents work from. If they are missing or wrong, an eval only measures how well the agent guesses.

## Wanted outcome

A map of what your agents are told today, which Phase 2 fixes.

---

## 1.1 Find the agent files

### [LLM]

> Narrate: "Let's see what your agents read."

### [HUMAN]

List the files.

## 1.2 Inspect them in Claude Code

### [HUMAN]

Run the commands.

## 1.3 Mark their status

### [HUMAN]

Write the inventory.

### [BRANCH]

- No agent files at all → say so in the inventory.

## 1.4 Gate check

The participant confirms, and you verify:

- [ ] Inventory lists every file type — read \`agent-inventory.md\`
- [ ] Worst gap named — ask the participant

---

## Phase Complete

Mark Phase 1 complete. Preview: "Phase 2 — you fix the worst gap."
`;

const MAP = parsePhaseMap(`## Phase map

| Phase | Day | Title | Document |
|---|---|---|---|
| 1 | 1 | Discover your agent setup | \`.agents/phases/01-DISCOVER.md\` |
`);

const lint = (text: string) => lintPhaseDoc(text, ".agents/phases/01-DISCOVER.md", MAP);

test("a document that follows the template passes", () => {
  const r = lint(GOOD);
  assert.equal(r.legacy, false);
  assert.deepEqual(r.errors, []);
  assert.equal(r.phase, 1);
});

test("old-format documents are reported as legacy, not as errors", () => {
  const r = lint("# Phase 1 — Attach your target\n\n## Overview\n\nText.\n\n## 1.1 [LLM] Check\n");
  assert.equal(r.legacy, true);
  assert.deepEqual(r.errors, []);
});

test("a sub-step that does not match its What you do item fails", () => {
  const r = lint(GOOD.replace("## 1.2 Inspect them in Claude Code", "## 1.2 Inspect the files"));
  assert.ok(r.errors.some((e) => e.includes('sub-step 1.2 is "Inspect the files"')), r.errors.join("\n"));
});

test("more actions than sub-steps fails", () => {
  const r = lint(GOOD.replace("3. **Mark their status**", "3. **Mark their status** — x\n4. **Share it**"));
  assert.ok(r.errors.some((e) => e.includes('4 "What you do" items but 3 sub-steps')), r.errors.join("\n"));
});

test("a missing Gate check fails", () => {
  const r = lint(GOOD.replace("## 1.4 Gate check", "## Room Gate"));
  assert.ok(r.errors.some((e) => e.includes("last sub-step must be")), r.errors.join("\n"));
});

test("Gate check must cover every Gate item and say how it is verified", () => {
  const r = lint(GOOD.replace("- [ ] Worst gap named — ask the participant\n", "- [ ] Worst gap named\n- [ ] Extra — x\n"));
  assert.ok(r.errors.some((e) => e.includes('"Gate check" has 3 checks but "Gate" has 2')), r.errors.join("\n"));
  assert.ok(r.errors.some((e) => e.includes("say how it is verified")), r.errors.join("\n"));
});

test("a sub-step without a [HUMAN] block fails", () => {
  const r = lint(GOOD.replace("### [HUMAN]\n\nRun the commands.", "### [LLM]\n\nRun the commands."));
  assert.ok(r.errors.some((e) => e.includes('sub-step 1.2 has no "### [HUMAN]" block')), r.errors.join("\n"));
});

test("template placeholders fail", () => {
  const r = lint(GOOD.replace("Mark Phase 1 complete.", "Mark Phase <N> complete."));
  assert.ok(r.errors.some((e) => e.includes("placeholders")), r.errors.join("\n"));
});

test("a two-sentence wanted outcome fails", () => {
  const r = lint(GOOD.replace("which Phase 2 fixes.", "which Phase 2 fixes. It is a file."));
  assert.ok(r.errors.some((e) => e.includes('"Wanted outcome" must be 1 sentence (found 2)')), r.errors.join("\n"));
});

test("a title that differs from the phase map fails", () => {
  const r = lint(GOOD.replace("# Phase 1 — Discover your agent setup", "# Phase 1 — Discover agents"));
  assert.ok(r.errors.some((e) => e.includes("differs from the phase map")), r.errors.join("\n"));
});

test("sentence counting ignores code and common abbreviations", () => {
  assert.equal(countSentences("Run `pnpm a.b` first, e.g. now. Then stop."), 2);
});

test("slash commands are collected, paths are not", () => {
  assert.deepEqual(findCommands("Run `/doctor prompt-audit` and `/memory`, not `/tmp/x` or `/Users/me`."), ["/doctor", "/memory"]);
});
