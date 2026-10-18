import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRecording } from "@workshop/evals";
import { beforeAll, describe, expect, it } from "vitest";
import { assertCommitted, loadAgentSuite, recordAgentRun, suiteFingerprint } from "../src/record.ts";
import { globToRegExp, gradeRule, loadJudge, loadRules, parseNameStatus, ruleContext } from "../src/rules.ts";
import { regradeRuns, runTasks } from "../src/run.ts";
import { sh } from "../src/sh.ts";
import type { AgentAdapter, AgentTask } from "../src/types.ts";

describe("rule helpers", () => {
  it("globs match whole paths", () => {
    expect(globToRegExp("data/**").test("data/a/b.json")).toBe(true);
    expect(globToRegExp("src/**/*.ts").test("src/x.ts")).toBe(true);
    expect(globToRegExp("src/*.ts").test("src/a/x.ts")).toBe(false);
    expect(globToRegExp("test/*.test.ts").test("test/vat.test.ts")).toBe(true);
  });
  it("parses name-status, renames keep the new path", () => {
    expect(parseNameStatus("A\tsrc/vat.ts\nM\tREADME.md\nR100\told.ts\tnew.ts\nD\tgone.ts\n")).toEqual([
      { status: "A", path: "src/vat.ts" },
      { status: "M", path: "README.md" },
      { status: "R", path: "new.ts" },
      { status: "D", path: "gone.ts" },
    ]);
  });
  it("grades booleans, verdicts and errors", async () => {
    const ctx = ruleContext({ id: "t", prompt: "p" }, parseNameStatus("A\tsrc/vat.ts\nM\tdata/codes.json\n"), "");
    expect(await gradeRule({ name: "R4", grade: (c) => c.touched("data/**").length === 0 }, ctx)).toMatchObject({ name: "rule:R4", pass: false });
    expect(await gradeRule({ name: "R3", grade: (c) => ({ pass: c.added("src/*.ts").length === 1 }) }, ctx)).toMatchObject({ pass: true, score: 1 });
    const err = await gradeRule({ name: "X", grade: () => { throw new Error("boom"); } }, ctx);
    expect(err.reason).toMatch(/grader error: boom/);
    await expect(ctx.run("true")).rejects.toThrow(/workspace is gone/);
  });
  it("names judges from the flag", async () => {
    const d = await mkdtemp(join(tmpdir(), "ae-judge-"));
    await writeFile(join(d, "rubric-r5.md"), "PASS when…");
    expect((await loadJudge("rubric-r5.md", d)).name).toBe("r5");
    expect((await loadJudge("R5=rubric-r5.md", d)).name).toBe("R5");
  });
});

// Repo: commit 1 = old CLAUDE.md; commit 2 = new CLAUDE.md, data file, eval suite folder.
let repo: string;
let work: string;
const g = (c: string) => sh(`git -c user.email=t@t -c user.name=t ${c}`, { cwd: repo });

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "ae-setup-"));
  work = await mkdtemp(join(tmpdir(), "ae-setup-work-"));
  await sh("git init -q -b main", { cwd: repo });
  await writeFile(join(repo, "CLAUDE.md"), "old rules\n");
  await writeFile(join(repo, "lib.mjs"), "export const one = () => 1;\n");
  await g("add -A");
  await g("commit -qm one");
  await writeFile(join(repo, "CLAUDE.md"), "new rules\n");
  await mkdir(join(repo, ".claude", "rules"), { recursive: true });
  await writeFile(join(repo, ".claude", "rules", "x.md"), "scoped\n");
  await mkdir(join(repo, "data"));
  await writeFile(join(repo, "data", "codes.json"), "[]\n");
  const suite = join(repo, "evals", "suites", "agent");
  await mkdir(suite, { recursive: true });
  await writeFile(join(suite, "rubric-r5.md"), "secret rubric\n");
  await writeFile(
    join(suite, "rules.ts"),
    `export default [
  { name: "R4", description: "never edit data/", grade: (c) => ({ pass: c.touched("data/**").length === 0, reason: "edited data/" }) },
  { name: "R3", tasks: ["t1"], grade: (c) => c.added("*.mjs").length > 0 },
];\n`,
  );
  await writeFile(join(suite, "agent-suite.json"), JSON.stringify({ name: "agent", rules: "rules.ts", threshold: { graders: { "rule:R4": 1 } }, tracks: ["../../../CLAUDE.md", "../../../.claude"] }));
  await writeFile(join(repo, ".gitignore"), ".claude/settings.local.json\n");
  await g("add -A");
  await g("commit -qm two");
  await writeFile(join(repo, ".claude", "settings.local.json"), "{}\n"); // ignored: must not affect fingerprints
});

const task = (id: string, base = "HEAD~1"): AgentTask => ({ id, base, prompt: `do ${id}`, testCommand: "true" });

function spy(edit?: (cwd: string) => Promise<void>) {
  const seen: Record<string, string> = {};
  const agent: AgentAdapter = {
    name: "spy",
    async run({ cwd }) {
      const r = await sh("cat CLAUDE.md 2>/dev/null; ls .claude evals/suites 2>&1", { cwd });
      seen[cwd] = r.stdout;
      await edit?.(cwd);
      return { ok: true, exitCode: 0, durationMs: 1, log: "" };
    },
  };
  return { agent, seen };
}

describe("setup on and off", () => {
  it("runs old-base tasks with HEAD's agent files, and without any when asked", async () => {
    const on = spy();
    await runTasks({ repo, tasks: [task("t1")], tasksFileDir: repo, agent: on.agent, workDir: join(work, "on"), concurrency: 1 });
    const seenOn = Object.values(on.seen)[0]!;
    expect(seenOn).toContain("new rules");
    expect(seenOn).toContain("rules");
    expect(seenOn).not.toContain("agent"); // eval suite folder never reaches the agent

    const off = spy();
    const r = await runTasks({ repo, tasks: [task("t1")], tasksFileDir: repo, agent: off.agent, workDir: join(work, "off"), concurrency: 1, withoutSetup: true });
    const seenOff = Object.values(off.seen)[0]!;
    expect(seenOff).not.toContain("rules");
    expect(seenOff).toMatch(/No such file/);
    expect((r.runs[0]!.output as any).setup).toBe("without");
    expect((r.runs[0]!.output as any).diff.files).toBe(0); // stripping isn't counted as the agent's change
  });
});

describe("rules in runs and re-grades", () => {
  it("grades the diff, skips rules for other tasks, and re-grades without the agent", async () => {
    const rules = await loadRules(join(repo, "evals", "suites", "agent", "rules.ts"));
    const editor = spy(async (cwd) => {
      await writeFile(join(cwd, "data", "codes.json"), "[1]\n");
      await writeFile(join(cwd, "vat.mjs"), "export const vat = 1;\n");
    });
    const run = await runTasks({ repo, tasks: [task("t1", "HEAD"), task("t2", "HEAD")], tasksFileDir: repo, agent: editor.agent, workDir: join(work, "rules"), rules, concurrency: 1, label: "base" });
    const t1 = run.runs.find((r) => r.caseId === "t1")!;
    const t2 = run.runs.find((r) => r.caseId === "t2")!;
    expect(t1.grades.find((x) => x.name === "rule:R4")).toMatchObject({ pass: false, reason: "edited data/" });
    expect(t1.grades.find((x) => x.name === "rule:R3")!.pass).toBe(true);
    expect(t2.grades.some((x) => x.name === "rule:R3")).toBe(false);
    expect((t1.output as any).changes).toContainEqual({ status: "A", path: "vat.mjs" });

    const lenient = [{ name: "R4", grade: () => true }];
    const re = await regradeRuns([run], { rules: lenient, label: "re" });
    expect(re.runs.find((r) => r.caseId === "t1")!.grades.map((x) => x.name)).toEqual(["hidden-tests", "agent-finished", "rule:R4"]);
    const both = await regradeRuns([run, { ...run, summary: { ...run.summary, label: "other" } }], { rules: lenient });
    expect(both.runs.map((r) => r.caseId)).toEqual(["base/t1", "base/t2", "other/t1", "other/t2"]);
  });
});

describe("record and verify", () => {
  it("records a fresh run that CI accepts, and goes stale when an agent file changes", async () => {
    const dir = join(repo, "evals", "suites", "agent");
    const suite = await loadAgentSuite(dir);
    await assertCommitted(repo, suite);
    const before = suiteFingerprint(suite);
    expect(Object.keys(before)).not.toContain("../../../.claude/settings.local.json");
    const clean = spy(async (cwd) => writeFile(join(cwd, "vat.mjs"), "export const vat = 1;\n"));
    const result = await runTasks({ repo, tasks: [task("t1", "HEAD")], tasksFileDir: repo, agent: clean.agent, workDir: join(work, "rec"), rules: suite.rules, threshold: suite.config.threshold, suiteName: "agent", concurrency: 1 });
    expect(result.summary.thresholdMet).toBe(true);
    recordAgentRun(suite, before, result, { agent: "spy", models: { agent: "x" } });
    expect(verifyRecording(dir).ok).toBe(true);

    await writeFile(join(repo, "CLAUDE.md"), "changed rules\n");
    await expect(assertCommitted(repo, suite)).rejects.toThrow(/commit these first/);
    const v = verifyRecording(dir);
    expect(v.ok).toBe(false);
    expect(v.changed).toEqual(["../../../CLAUDE.md"]);
    await sh("git checkout -q CLAUDE.md", { cwd: repo });
    expect(JSON.parse(await readFile(join(dir, "last-run.json"), "utf8")).summary.threshold).toEqual({ graders: { "rule:R4": 1 } });
  });
});

describe("claude adapter setup flags", () => {
  it("uses project settings only, or --safe-mode without the setup", async () => {
    const bin = await mkdtemp(join(tmpdir(), "ae-bin2-"));
    const argsFile = join(bin, "args.json");
    await writeFile(join(bin, "claude"), `#!/usr/bin/env node\nrequire("fs").writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\nconsole.log(JSON.stringify({type:"result",subtype:"success",result:"ok"}));\n`, { mode: 0o755 });
    const { claude } = await import("../src/agents.ts");
    const prev = process.env.PATH;
    process.env.PATH = `${bin}:${prev}`;
    try {
      await claude.run({ cwd: bin, prompt: "x", timeoutMs: 20_000 });
      const on = JSON.parse(await readFile(argsFile, "utf8")) as string[];
      expect(on.slice(0, 2)).toEqual(["--setting-sources", "project,local"]);
      expect(on).not.toContain("--safe-mode");
      await claude.run({ cwd: bin, prompt: "x", timeoutMs: 20_000, withoutSetup: true });
      const off = JSON.parse(await readFile(argsFile, "utf8")) as string[];
      expect(off[0]).toBe("--safe-mode");
      expect(off).not.toContain("--setting-sources");
    } finally {
      process.env.PATH = prev;
    }
  });
});

describe("rubric frontmatter", () => {
  it("reads the task list and strips it from the rubric", async () => {
    const { parseRubric } = await import("../src/rules.ts");
    expect(parseRubric("---\ntasks: csv-import, vat-split\n---\nPASS when…\n")).toEqual({ rubric: "PASS when…\n", tasks: ["csv-import", "vat-split"] });
    expect(parseRubric("PASS when…")).toEqual({ rubric: "PASS when…" });
  });
});
