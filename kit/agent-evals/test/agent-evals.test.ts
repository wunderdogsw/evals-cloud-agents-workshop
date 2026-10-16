import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { mineTasks } from "../src/mine.ts";
import { runTasks } from "../src/run.ts";
import { sh } from "../src/sh.ts";
import type { AgentAdapter } from "../src/types.ts";
import { noop } from "../src/agents.ts";

// Tiny repo: commit 1 = lib without `double`; commit 2 = adds `double` + its test.
let repo: string;
let work: string;
const TEST_CMD = `node --test {files}`;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "ae-repo-"));
  work = await mkdtemp(join(tmpdir(), "ae-work-"));
  const g = (c: string) => sh(`git -c user.email=t@t -c user.name=t ${c}`, { cwd: repo });
  await sh("git init -q -b main", { cwd: repo });
  await writeFile(join(repo, "lib.mjs"), "export const one = () => 1;\n");
  await g("add -A");
  await g("commit -qm init");
  await writeFile(join(repo, "lib.mjs"), "export const one = () => 1;\nexport const double = (n) => n * 2;\n");
  await mkdir(join(repo, "test"));
  await writeFile(join(repo, "test", "double.test.mjs"), "import { test } from 'node:test';\nimport assert from 'node:assert';\nimport { double } from '../lib.mjs';\ntest('double', () => assert.equal(double(21), 42));\n");
  await g("add -A");
  await g("commit -qm 'Add double helper'");
});

describe("mine", () => {
  it("finds the change that touched source and tests", async () => {
    const found = await mineTasks(repo, { testCommand: TEST_CMD });
    expect(found).toHaveLength(1);
    expect(found[0]!.hiddenTests!.paths).toEqual(["test/double.test.mjs"]);
    expect(found[0]!.prompt).toMatch(/^TODO/);
  });
});

describe("run", () => {
  it("noop fails, reference passes, a good agent passes and the history is hidden", async () => {
    const [t] = await mineTasks(repo, { testCommand: TEST_CMD });
    const task = { ...t!, prompt: "Add an exported `double(n)` to lib.mjs." };
    const common = { repo, tasks: [task], tasksFileDir: repo, concurrency: 1 };

    const base = await runTasks({ ...common, agent: noop, workDir: join(work, "noop") });
    expect(base.runs[0]!.error).toBeUndefined();
    expect(base.runs[0]!.pass).toBe(false);

    const ref = await runTasks({ ...common, agent: noop, useReference: true, workDir: join(work, "ref") });
    expect(ref.runs[0]!.pass).toBe(true);

    let sawHistory = "";
    const fake: AgentAdapter = {
      name: "fake",
      async run({ cwd }) {
        sawHistory = (await sh("git log --oneline --all", { cwd })).stdout;
        await writeFile(join(cwd, "lib.mjs"), "export const one = () => 1;\nexport const double = (n) => n + n;\n");
        return { ok: true, exitCode: 0, durationMs: 1, log: "", costUsd: 0.01 };
      },
    };
    const good = await runTasks({ ...common, agent: fake, workDir: join(work, "fake") });
    expect(good.runs[0]!.pass).toBe(true);
    expect((good.runs[0]!.output as any).diff.files).toBe(1);
    expect(good.summary.totalCostUsd).toBeCloseTo(0.01);
    expect(sawHistory).not.toContain("Add double helper");
  });
});

describe("claude adapter", () => {
  it("passes prompts with backticks and $ verbatim (no shell)", async () => {
    const bin = await mkdtemp(join(tmpdir(), "ae-bin-"));
    const argsFile = join(bin, "args.json");
    await writeFile(
      join(bin, "claude"),
      `#!/usr/bin/env node\nrequire("fs").writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\nconsole.log(JSON.stringify({type:"result",subtype:"success",result:"done",total_cost_usd:0.5,num_turns:3}));\n`,
      { mode: 0o755 },
    );
    const { claude } = await import("../src/agents.ts");
    const prev = process.env.PATH;
    process.env.PATH = `${bin}:${prev}`;
    try {
      const prompt = "Add `splitVat()` costing $HOME and \"quotes\"";
      const out = await claude.run({ cwd: bin, prompt, timeoutMs: 20_000 });
      const argv = JSON.parse(await (await import("node:fs/promises")).readFile(argsFile, "utf8"));
      expect(argv[1]).toBe(prompt);
      expect(out.ok).toBe(true);
      expect(out.costUsd).toBe(0.5);
      expect(out.turns).toBe(3);
    } finally {
      process.env.PATH = prev;
    }
  });
});
