#!/usr/bin/env -S npx tsx
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseJsonl, toMarkdown, writeRun } from "@workshop/evals";
import { AGENTS } from "./agents.ts";
import { mineTasks } from "./mine.ts";
import { runTasks } from "./run.ts";
import type { AgentTask } from "./types.ts";

const HELP = `agent-evals — benchmark coding agents on your own repo

  agent-evals mine <repo> --test-command "<cmd>" [--since "6 months ago"] [--limit 30] [--out tasks.jsonl]
      Find landed changes that touched source + tests. Writes candidate tasks — rewrite each prompt by hand.

  agent-evals validate <repo> --tasks tasks.jsonl [--setup "<cmd>"]
      For every task: hidden tests must FAIL at base (noop) and, if a reference exists, PASS with it.
      Drop or fix tasks that don't.

  agent-evals run <repo> --tasks tasks.jsonl --agent claude|cursor|noop [--setup "<cmd>"]
      [--model id] [--max-turns 40] [--max-budget-usd 2] [--concurrency 2] [--judge rubric.md] [--label name]

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
      judge: { type: "string" },
      label: { type: "string" },
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

  if (cmd === "run") {
    const agent = AGENTS[values.agent!];
    if (!agent) throw new Error(`unknown agent "${values.agent}". Options: ${Object.keys(AGENTS).join(", ")}`);
    const label = values.label ?? `${agent.name}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
    const judgeRubric = values.judge ? await readFile(values.judge, "utf8") : undefined;
    const result = await runTasks({
      ...common,
      agent,
      label,
      workDir: join(runsRoot, label),
      model: values.model,
      maxTurns: values["max-turns"] ? Number(values["max-turns"]) : undefined,
      maxBudgetUsd: values["max-budget-usd"] ? Number(values["max-budget-usd"]) : undefined,
      judgeRubric,
      onTask: progress,
    });
    const dir = await writeRun(result, outDir);
    console.log(toMarkdown(result));
    console.log(`→ ${dir}\nWorkspaces kept in ${join(runsRoot, label)}/ — open one and run \`git diff eval-base\` to read what the agent did.`);
    return;
  }

  throw new Error(`unknown command "${cmd}"\n\n${HELP}`);
}

main().catch((e) => {
  console.error(`agent-evals: ${(e as Error).message}`);
  process.exit(2);
});
