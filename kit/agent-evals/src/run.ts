import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { llmJudge, summarize, type CaseRun, type GradeResult, type RunResult } from "@workshop/evals";
import { sh, tail } from "./sh.ts";
import type { AgentAdapter, AgentTask } from "./types.ts";
import { applyHiddenTests, applyReference, commitAll, diffStat, snapshot } from "./workspace.ts";

export interface RunTasksOptions {
  repo: string;
  tasks: AgentTask[];
  tasksFileDir: string;
  agent: AgentAdapter;
  workDir: string;
  setupCommand?: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  concurrency?: number;
  /** Optional rubric for an LLM judge over the agent's diff. */
  judgeRubric?: string;
  /** "validate" mode: apply the reference solution instead of running an agent. */
  useReference?: boolean;
  label?: string;
  onTask?: (run: CaseRun) => void;
}

/**
 * For each task: fresh history-free snapshot → setup → agent → diff → hidden tests → test command.
 * Output uses the same RunResult shape as the eval kit, so `evals compare` works on agent runs too.
 */
export async function runTasks(o: RunTasksOptions): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const runs: CaseRun[] = [];
  const judge = o.judgeRubric
    ? llmJudge({
        name: "judge:diff",
        rubric: o.judgeRubric,
        render: (c: any, out: any) => `<task>\n${c.input.prompt}\n</task>\n\n<diff>\n${out.patch.slice(0, 60_000)}\n</diff>\n\n<agent_summary>\n${out.summary ?? ""}\n</agent_summary>`,
      })
    : undefined;

  const queue = [...o.tasks];
  const worker = async () => {
    for (let task = queue.shift(); task; task = queue.shift()) {
      const t0 = Date.now();
      const dir = resolve(o.workDir, `${task.id}-${o.agent.name}`);
      const run: CaseRun = { caseId: task.id, trial: 1, tags: task.tags ?? [], input: { prompt: task.prompt, base: task.base }, grades: [], pass: false, durationMs: 0, costUsd: 0 };
      try {
        await snapshot(o.repo, task.base, dir);
        const setup = task.setupCommand ?? o.setupCommand;
        if (setup) {
          const s = await sh(setup, { cwd: dir, timeoutMs: 10 * 60_000 });
          if (s.code !== 0) throw new Error(`setup failed (${setup}): ${tail(s.stderr, 600)}`);
        }
        await commitAll(dir, "setup");
        await sh("git tag -f eval-base", { cwd: dir });

        let agentOut;
        if (o.useReference) {
          await applyReference(task, o.repo, dir, o.tasksFileDir);
          agentOut = { ok: true, exitCode: 0, durationMs: 0, summary: "reference solution", log: "" };
        } else {
          agentOut = await o.agent.run({ cwd: dir, prompt: task.prompt, timeoutMs: (task.timeoutMin ?? 20) * 60_000, model: o.model, maxTurns: o.maxTurns, maxBudgetUsd: o.maxBudgetUsd });
        }
        run.costUsd += agentOut.costUsd ?? 0;

        const diff = await diffStat(dir);
        const hidden = await applyHiddenTests(task, o.repo, dir, o.tasksFileDir);
        // `{files}` in the test command expands to the hidden test paths, e.g. "npx vitest run {files}".
        const cmd = task.testCommand.replace("{files}", hidden.map((h) => JSON.stringify(h)).join(" "));
        const test = await sh(cmd, { cwd: dir, timeoutMs: 15 * 60_000 });
        run.output = {
          agentOk: agentOut.ok,
          turns: agentOut.turns,
          summary: agentOut.summary,
          diff: { files: diff.files, added: diff.added, removed: diff.removed },
          hiddenTests: hidden,
          testExit: test.code,
          testTail: tail(test.stdout + test.stderr, 1500),
          workspace: dir,
        };
        run.grades.push({
          name: "hidden-tests",
          pass: test.code === 0,
          score: test.code === 0 ? 1 : 0,
          reason: test.code === 0 ? undefined : test.timedOut ? "tests timed out" : `exit ${test.code}: ${tail(test.stdout + test.stderr, 300).replace(/\s+/g, " ")}`,
        });
        run.grades.push({ name: "agent-finished", pass: agentOut.ok, score: agentOut.ok ? 1 : 0, reason: agentOut.ok ? undefined : tail(agentOut.log, 300) });
        if (judge && !o.useReference) {
          let g: GradeResult;
          try {
            g = await judge.grade({ case: { id: task.id, input: { prompt: task.prompt } }, output: { patch: diff.patch, summary: agentOut.summary } });
          } catch (e) {
            g = { name: "judge:diff", pass: false, score: 0, reason: `judge error: ${(e as Error).message}` };
          }
          run.costUsd += g.costUsd ?? 0;
          run.grades.push(g);
        }
        // A task passes on hidden tests alone; the other grades are diagnostics.
        run.pass = test.code === 0;
      } catch (e) {
        run.error = (e as Error).message;
        run.grades.push({ name: "hidden-tests", pass: false, score: 0, reason: "harness error" });
      }
      run.durationMs = Date.now() - t0;
      runs.push(run);
      o.onTask?.(run);
    }
  };
  await mkdir(o.workDir, { recursive: true });
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 2) }, worker));
  runs.sort((a, b) => a.caseId.localeCompare(b.caseId));
  return { summary: summarize(`agent-${o.agent.name}`, runs, startedAt, 1, undefined, o.label), runs };
}

