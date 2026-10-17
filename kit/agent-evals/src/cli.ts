#!/usr/bin/env -S npx tsx
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { model as defaultModel, parseJsonl, toMarkdown, writeRun, type HumanLabel, type RunResult } from "@workshop/evals";
import { AGENTS, patchAgent } from "./agents.ts";
import { mineTasks } from "./mine.ts";
import { assertCommitted, loadAgentSuite, recordAgentRun, suiteFingerprint } from "./record.ts";
import { loadJudge, loadRules } from "./rules.ts";
import { regradeRuns, runTasks, type AgentTaskOutput } from "./run.ts";
import type { AgentTask } from "./types.ts";

const HELP = `agent-evals — benchmark coding agents on your own repo

  agent-evals mine <repo> --test-command "<cmd>" [--since "6 months ago"] [--limit 30] [--out tasks.jsonl]
      Find landed changes that touched source + tests. Writes candidate tasks — rewrite each prompt by hand.

  agent-evals validate <repo> --tasks tasks.jsonl [--setup "<cmd>"]
      For every task: hidden tests must FAIL at base (noop) and, if a reference exists, PASS with it.
      Drop or fix tasks that don't.

  agent-evals run <repo> --tasks tasks.jsonl --agent claude|cursor|noop [--setup "<cmd>"]
      [--model id] [--max-turns 40] [--max-budget-usd 2] [--concurrency 2] [--label name]
      [--without-setup]          strip CLAUDE.md, AGENTS.md, .claude/, .cursor/ … and run Claude Code in --safe-mode
      [--rules rules.ts]         rule graders over each diff → "rule:<name>"
      [--judge R5=rubric.md]     LLM judge over each diff → "judge:R5" (repeatable)
      [--record <suite dir>]     full run with the suite's rules, judges and threshold → <suite dir>/last-run.json
      Every task runs with the agent files committed at the target's HEAD, even when its base is older.

  agent-evals regrade <run> [<run> …] [--rules rules.ts] [--judge R5=rubric.md] [--tasks tasks.jsonl] [--label name]
      Re-grade finished runs without running the agent. Two or more runs are combined, ids "<run label>/<task>".

  agent-evals label <run> [<run> …] --out labels.jsonl [--rule "R5: comma parsing at the edges"]
      Label each diff PASS/FAIL by hand, blind (no judge verdicts shown). Ids match "regrade" of the same runs.

  agent-evals grade-patch <repo> --tasks tasks.jsonl --task <id> (--patch change.diff | --reference) --rules rules.ts
      Prove a grader: apply a planted violation (or the reference solution) to the task's base and grade it.

Results land in <control-room>/.eval-runs/ in the same format as the eval kit,
so "pnpm evals compare <a> <b>" compares two agents or two AGENTS.md versions.`;

async function loadTasks(path: string): Promise<AgentTask[]> {
  const tasks = parseJsonl<AgentTask>(await readFile(path, "utf8"), path).filter((t: any) => t && t.id);
  const todo = tasks.filter((t) => t.prompt.startsWith("TODO"));
  if (todo.length) throw new Error(`${todo.length} task(s) still have TODO prompts: ${todo.map((t) => t.id).join(", ")}. Rewrite them first.`);
  return tasks;
}

function findControlRoom(): string {
  let d = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(d, ".agents", "phases"))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return process.cwd();
}

function runDirs(outDir: string): string[] {
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir)
    .map((d) => join(outDir, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "results.json")))
    .sort();
}

/** A results.json, a run directory, "latest" / "latest~n", or a run label (newest match). */
async function loadRun(ref: string, outDir: string): Promise<RunResult> {
  let path = ref;
  const m = /^latest(?:~(\d+))?$/.exec(ref);
  if (m) {
    const dirs = runDirs(outDir);
    path = dirs[dirs.length - 1 - Number(m[1] ?? 0)] ?? "";
    if (!path) throw new Error(`no run "${ref}" in ${outDir}`);
  } else if (!existsSync(path)) {
    const safe = ref.replace(/[^\w.-]+/g, "_");
    path = runDirs(outDir).filter((d) => d.endsWith(`-${safe}`)).pop() ?? "";
    if (!path) throw new Error(`no run "${ref}": not a path, "latest[~n]", or a label in ${outDir}`);
  }
  if (statSync(path).isDirectory()) path = join(path, "results.json");
  return JSON.parse(await readFile(path, "utf8")) as RunResult;
}

async function main() {
  const root = findControlRoom();
  if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      tasks: { type: "string" },
      agent: { type: "string", default: "claude" },
      setup: { type: "string" },
      "test-command": { type: "string" },
      since: { type: "string" },
      limit: { type: "string" },
      out: { type: "string" },
      model: { type: "string" },
      "max-turns": { type: "string" },
      "max-budget-usd": { type: "string" },
      concurrency: { type: "string" },
      judge: { type: "string", multiple: true },
      label: { type: "string" },
      rules: { type: "string" },
      record: { type: "string" },
      "without-setup": { type: "boolean", default: false },
      task: { type: "string" },
      patch: { type: "string" },
      reference: { type: "boolean", default: false },
      rule: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (!cmd || values.help || cmd === "help") return console.log(HELP);
  const repo = resolve(positionals[0] ?? ".");
  const outDir = join(root, ".eval-runs");
  // Agent workspaces live OUTSIDE the control room: no parent CLAUDE.md/AGENTS.md from the guide,
  // and the hidden tests in .workshop/ are not a `cd ..` away.
  const runsRoot = resolve(process.env.WORKSHOP_RUNS_DIR ?? join(tmpdir(), "workshop-agent-runs"));

  if (cmd === "mine") {
    if (!values["test-command"]) throw new Error('--test-command is required (use "{files}" to run only the hidden tests)');
    const found = await mineTasks(repo, { since: values.since, limit: values.limit ? Number(values.limit) : 30, testCommand: values["test-command"] });
    const out = values.out ?? "tasks.candidates.jsonl";
    await writeFile(out, found.map((t) => JSON.stringify(t)).join("\n") + "\n");
    console.log(`${found.length} candidates → ${out}\n`);
    for (const t of found) console.log(`- ${t.id}  (${t.meta.sourceFiles.length} src, ${t.meta.testFiles.length} test, ${t.meta.linesChanged} lines)  ${t.meta.subject}`);
    console.log(`\nPick 5–10 good ones, rewrite each "prompt" as an issue, save as tasks.jsonl, then run "validate".`);
    return;
  }

  const judgeSpecs = () => Promise.all((values.judge ?? []).map((j) => loadJudge(j)));

  if (cmd === "regrade") {
    if (!positionals.length) throw new Error("usage: agent-evals regrade <run> [<run> …] [--rules rules.ts] [--judge R5=rubric.md]");
    const sources = await Promise.all(positionals.map((p) => loadRun(p, outDir)));
    const rules = values.rules ? await loadRules(values.rules) : [];
    const judges = await judgeSpecs();
    if (!rules.length && !judges.length) throw new Error("nothing to grade with: pass --rules and/or --judge");
    const tasks = values.tasks ? new Map((await loadTasks(resolve(values.tasks))).map((t) => [t.id, t])) : undefined;
    const label = values.label ?? `regrade-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
    const result = await regradeRuns(sources, { rules, judges, tasks, label, onTask: (r) => process.stderr.write(`${r.grades.filter((g) => /^(rule|judge):/.test(g.name)).map((g) => `${g.pass ? "✓" : "✗"} ${g.name}`).join("  ") || "–"}  ${r.caseId}\n`) });
    const dir = await writeRun(result, outDir);
    console.log(toMarkdown(result));
    console.log(`→ ${dir}`);
    return;
  }

  if (cmd === "label") {
    if (!positionals.length || !values.out) throw new Error("usage: agent-evals label <run> [<run> …] --out labels.jsonl");
    const sources = await Promise.all(positionals.map((p) => loadRun(p, outDir)));
    const prefix = sources.length > 1;
    const out = values.out;
    const labels: HumanLabel[] = existsSync(out) ? parseJsonl<HumanLabel>(await readFile(out, "utf8")) : [];
    const done = new Set(labels.map((l) => l.id));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`Label each change PASS (p) or FAIL (f)${values.rule ? ` for: ${values.rule}` : ""}. A note after a space is kept: "f parses commas in core". s = skip, q = quit.\nJudge verdicts are hidden on purpose.\n`);
    outer: for (const src of sources) {
      for (const r of src.runs) {
        const id = prefix ? `${src.summary.label ?? src.summary.startedAt}/${r.caseId}` : r.caseId;
        const o = r.output as Partial<AgentTaskOutput> | undefined;
        if (done.has(id) || r.error || typeof o?.patch !== "string") continue;
        console.log(`\n━━━ ${id}${o.setup ? ` (${o.setup} setup)` : ""}\n${(r.input as any)?.prompt ?? ""}\n`);
        console.log(o.patch.length > 12_000 ? `${o.patch.slice(0, 12_000)}\n… (${o.patch.length} chars; full diff in ${o.workspace}: git diff eval-base)` : o.patch || "(no changes)");
        const ans = (await rl.question("p/f/s/q > ")).trim();
        if (ans === "q") break outer;
        if (!ans || ans === "s") continue;
        const [v, ...note] = ans.split(" ");
        labels.push({ id, pass: v!.toLowerCase().startsWith("p"), ...(note.length ? { note: note.join(" ") } : {}) });
        await writeFile(out, labels.map((l) => JSON.stringify(l)).join("\n") + "\n");
      }
    }
    rl.close();
    console.log(`\n${labels.length} labels in ${out}.`);
    return;
  }

  if (!values.tasks) throw new Error("--tasks is required");
  const tasksPath = resolve(values.tasks);
  const tasks = await loadTasks(tasksPath);
  const common = { repo, tasks, tasksFileDir: dirname(tasksPath), setupCommand: values.setup, concurrency: values.concurrency ? Number(values.concurrency) : 2 };
  const progress = (r: any) => process.stderr.write(`${r.pass ? "✓" : r.error ? "!" : "✗"} ${r.caseId}  ${(r.durationMs / 1000).toFixed(0)}s${r.costUsd ? `  $${r.costUsd.toFixed(3)}` : ""}${r.error ? `  ${r.error}` : ""}\n`);

  if (cmd === "validate") {
    console.log("1/2 noop — hidden tests should FAIL at base");
    const base = await runTasks({ ...common, agent: AGENTS.noop!, workDir: join(runsRoot, "validate-noop"), label: "validate-noop", onTask: progress });
    const withRef = tasks.filter((t) => t.reference || t.referenceDir);
    let ref;
    if (withRef.length) {
      console.log("2/2 reference — hidden tests should PASS with the real change");
      ref = await runTasks({ ...common, tasks: withRef, agent: AGENTS.noop!, useReference: true, workDir: join(runsRoot, "validate-ref"), label: "validate-ref", onTask: progress });
    }
    console.log("\n| Task | Fails at base | Passes with reference | Verdict |\n|---|---|---|---|");
    let bad = 0;
    for (const t of tasks) {
      const b = base.runs.find((r) => r.caseId === t.id)!;
      const r = ref?.runs.find((x) => x.caseId === t.id);
      const failsAtBase = !b.pass && !b.error;
      const passesRef = r ? r.pass : undefined;
      const ok = failsAtBase && passesRef !== false;
      if (!ok) bad++;
      console.log(`| ${t.id} | ${b.error ? "error" : failsAtBase ? "yes" : "**no — measures nothing**"} | ${passesRef === undefined ? "n/a" : passesRef ? "yes" : "**no — flaky or env issue**"} | ${ok ? "✅ keep" : "❌ fix or drop"} |`);
    }
    if (bad) process.exitCode = 1;
    return;
  }

  if (cmd === "grade-patch") {
    const task = tasks.find((t) => t.id === values.task);
    if (!task) throw new Error(`--task: no task "${values.task}" in ${tasksPath}`);
    if (!values.rules) throw new Error("--rules is required");
    if (!values.patch === !values.reference) throw new Error("pass exactly one of --patch <file> or --reference");
    const rules = await loadRules(values.rules);
    const label = `grade-patch-${task.id}`;
    const agent = values.patch ? patchAgent(resolve(values.patch)) : AGENTS.noop!;
    const result = await runTasks({ ...common, tasks: [task], agent, useReference: values.reference, rules, workDir: join(runsRoot, label), label });
    const r = result.runs[0]!;
    if (r.error) throw new Error(r.error);
    console.log(`${task.id} with ${values.patch ? values.patch : "the reference solution"}:`);
    for (const g of r.grades.filter((x) => x.name.startsWith("rule:"))) console.log(`  ${g.pass ? "✓ pass" : "✗ FAIL"}  ${g.name}${g.reason ? ` — ${g.reason}` : ""}`);
    const skipped = rules.filter((x) => !r.grades.some((g) => g.name === `rule:${x.name}`));
    if (skipped.length) console.log(`  (not applied to this task: ${skipped.map((x) => x.name).join(", ")})`);
    return;
  }

  if (cmd === "run") {
    const agent = AGENTS[values.agent!];
    if (!agent) throw new Error(`unknown agent "${values.agent}". Options: ${Object.keys(AGENTS).join(", ")}`);
    const label = values.label ?? `${agent.name}${values["without-setup"] ? "-without" : ""}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
    let rules = values.rules ? await loadRules(values.rules) : [];
    let judges = await judgeSpecs();
    const suite = values.record ? await loadAgentSuite(values.record) : undefined;
    let before: Record<string, string> | undefined;
    if (suite) {
      if (values.rules || values.judge?.length) throw new Error("--record takes rules and judges from agent-suite.json; drop --rules/--judge");
      if (values["without-setup"]) throw new Error("--record measures your setup; drop --without-setup");
      if (agent.name === "noop") throw new Error("--record needs a real agent");
      await assertCommitted(repo, suite);
      rules = suite.rules;
      judges = suite.judges;
      before = suiteFingerprint(suite);
    }
    const result = await runTasks({
      ...common,
      agent,
      label,
      workDir: join(runsRoot, label),
      model: values.model,
      maxTurns: values["max-turns"] ? Number(values["max-turns"]) : undefined,
      maxBudgetUsd: values["max-budget-usd"] ? Number(values["max-budget-usd"]) : undefined,
      rules,
      judges,
      withoutSetup: values["without-setup"],
      ...(suite ? { suiteName: suite.config.name ?? "agent", threshold: suite.config.threshold } : {}),
      onTask: progress,
    });
    const dir = await writeRun(result, outDir);
    console.log(toMarkdown(result));
    if (suite && before) {
      const p = recordAgentRun(suite, before, result, { agent: agent.name, models: { agent: values.model ?? (agent.name === "claude" ? defaultModel("agent") : "default"), ...(judges.length ? { judge: defaultModel("judge") } : {}) } });
      console.log(`→ recorded ${p}: commit it with your change`);
    }
    console.log(`→ ${dir}\nWorkspaces kept in ${join(runsRoot, label)}/ — open one and run \`git diff eval-base\` to read what the agent did.`);
    return;
  }

  throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
}

main().catch((e) => {
  console.error(`agent-evals: ${(e as Error).message}`);
  process.exit(2);
});
