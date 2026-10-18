import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { llmJudge, summarize, type CaseRun, type GradeResult, type Grader, type RunResult, type Threshold } from "@workshop/evals";
import { appliesTo, gradeRule, parseNameStatus, ruleContext, type ChangedFile, type JudgeSpec, type RuleGrader } from "./rules.ts";
import { sh, tail } from "./sh.ts";
import type { AgentAdapter, AgentTask } from "./types.ts";
import { applyHiddenTests, applyReference, commitAll, diffStat, overlaySetup, snapshot, strip } from "./workspace.ts";

/** Patches above this size are cut in results.json; rules and judges see the cut version on re-grading. */
const MAX_PATCH = 200_000;

/** What runTasks stores per task in `CaseRun.output`. */
export interface AgentTaskOutput {
  agentOk: boolean;
  turns?: number;
  summary?: string;
  setup: "with" | "without";
  diff: { files: number; added: number; removed: number };
  changes: ChangedFile[];
  patch: string;
  patchTruncated?: boolean;
  hiddenTests: string[];
  testExit: number | null;
  testTail: string;
  workspace: string;
}

function diffJudge(j: JudgeSpec): Grader {
  return llmJudge({
    name: `judge:${j.name}`,
    rubric: j.rubric,
    render: (c: any, out: any) => `<task>\n${c.input.prompt}\n</task>\n\n<diff>\n${String(out.patch).slice(0, 60_000)}\n</diff>\n\n<agent_summary>\n${out.summary ?? ""}\n</agent_summary>`,
  });
}

/** Rule and judge grades for one task's change. Rules that don't apply to the task give no grade. */
export async function gradeChange(
  task: Pick<AgentTask, "id" | "prompt" | "tags">,
  out: { changes: ChangedFile[]; patch: string; summary?: string; workspace?: string },
  rules: RuleGrader[] = [],
  judges: JudgeSpec[] = [],
): Promise<GradeResult[]> {
  const grades: GradeResult[] = [];
  const ctx = ruleContext({ id: task.id, prompt: task.prompt, tags: task.tags }, out.changes, out.patch, out.workspace);
  for (const r of rules) if (appliesTo(r, task.id)) grades.push(await gradeRule(r, ctx));
  for (const j of judges) {
    if (j.tasks?.length && !j.tasks.includes(task.id)) continue;
    const g = diffJudge(j);
    try {
      grades.push(await g.grade({ case: { id: task.id, input: { prompt: task.prompt } }, output: { patch: out.patch, summary: out.summary } }));
    } catch (e) {
      grades.push({ name: g.name, pass: false, score: 0, reason: `judge error: ${(e as Error).message}` });
    }
  }
  return grades;
}

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
  /** Optional rubric for an LLM judge over the agent's diff (reported as "judge:diff"). */
  judgeRubric?: string;
  /** LLM judges over the diff, one per judgement rule (reported as "judge:<name>"). */
  judges?: JudgeSpec[];
  /** Deterministic rule graders over the diff (reported as "rule:<name>"). */
  rules?: RuleGrader[];
  /** Run without the agent setup: strip agent files from the workspace and turn customisations off. */
  withoutSetup?: boolean;
  /** Commit whose agent files every task runs with (default HEAD of the target). */
  setupRev?: string;
  /** Suite name in the summary. Default "agent-<agent>". */
  suiteName?: string;
  threshold?: Threshold;
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
  const judges = [...(o.judgeRubric ? [{ name: "diff", rubric: o.judgeRubric }] : []), ...(o.judges ?? [])];

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
        if (!o.withoutSetup && !o.useReference) await overlaySetup(o.repo, dir, o.setupRev ?? "HEAD");
        await strip(dir, { withoutSetup: o.withoutSetup });
        await commitAll(dir, "setup");
        await sh("git tag -f eval-base", { cwd: dir });

        let agentOut;
        if (o.useReference) {
          await applyReference(task, o.repo, dir, o.tasksFileDir);
          agentOut = { ok: true, exitCode: 0, durationMs: 0, summary: "reference solution", log: "" };
        } else {
          agentOut = await o.agent.run({ cwd: dir, prompt: task.prompt, timeoutMs: (task.timeoutMin ?? 20) * 60_000, model: o.model, maxTurns: o.maxTurns, maxBudgetUsd: o.maxBudgetUsd, withoutSetup: o.withoutSetup });
        }
        run.costUsd += agentOut.costUsd ?? 0;

        const diff = await diffStat(dir);
        const changes = parseNameStatus(diff.nameStatus);
        // Rules run on the agent's change before the hidden tests are copied in.
        const ruleAndJudge = o.useReference && !o.rules?.length ? [] : await gradeChange(task, { changes, patch: diff.patch, summary: agentOut.summary, workspace: dir }, o.rules, o.useReference ? [] : judges);
        const hidden = await applyHiddenTests(task, o.repo, dir, o.tasksFileDir);
        // `{files}` in the test command expands to the hidden test paths, e.g. "npx vitest run {files}".
        const cmd = task.testCommand.replace("{files}", hidden.map((h) => JSON.stringify(h)).join(" "));
        const test = await sh(cmd, { cwd: dir, timeoutMs: 15 * 60_000 });
        const output: AgentTaskOutput = {
          agentOk: agentOut.ok,
          turns: agentOut.turns,
          summary: agentOut.summary,
          setup: o.withoutSetup ? "without" : "with",
          diff: { files: diff.files, added: diff.added, removed: diff.removed },
          changes,
          patch: diff.patch.slice(0, MAX_PATCH),
          ...(diff.patch.length > MAX_PATCH ? { patchTruncated: true } : {}),
          hiddenTests: hidden,
          testExit: test.code,
          testTail: tail(test.stdout + test.stderr, 1500),
          workspace: dir,
        };
        run.output = output;
        run.grades.push({
          name: "hidden-tests",
          pass: test.code === 0,
          score: test.code === 0 ? 1 : 0,
          reason: test.code === 0 ? undefined : test.timedOut ? "tests timed out" : `exit ${test.code}: ${tail(test.stdout + test.stderr, 300).replace(/\s+/g, " ")}`,
        });
        run.grades.push({ name: "agent-finished", pass: agentOut.ok, score: agentOut.ok ? 1 : 0, reason: agentOut.ok ? undefined : tail(agentOut.log, 300) });
        for (const g of ruleAndJudge) {
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
  return { summary: summarize(o.suiteName ?? `agent-${o.agent.name}`, runs, startedAt, 1, o.threshold, o.label), runs };
}


/**
 * Re-grade finished runs with new rules and judges, without running the agent again.
 * Old rule:/judge: grades are replaced; hidden-tests and agent-finished stay. With more than one run,
 * case ids become "<run label>/<task id>" so runs with and without the setup can be labelled together.
 */
export async function regradeRuns(
  sources: RunResult[],
  o: { rules?: RuleGrader[]; judges?: JudgeSpec[]; tasks?: Map<string, AgentTask>; label?: string; suiteName?: string; threshold?: Threshold; onTask?: (run: CaseRun) => void },
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const prefix = sources.length > 1;
  const runs: CaseRun[] = [];
  for (const src of sources) {
    const tag = src.summary.label ?? src.summary.startedAt;
    for (const r of src.runs) {
      const out = r.output as Partial<AgentTaskOutput> | undefined;
      const next: CaseRun = { ...r, caseId: prefix ? `${tag}/${r.caseId}` : r.caseId, grades: r.grades.filter((g) => !g.name.startsWith("rule:") && !g.name.startsWith("judge:")), costUsd: 0 };
      if (out && typeof out.patch === "string" && !r.error) {
        const t = o.tasks?.get(r.caseId);
        const prompt = t?.prompt ?? (r.input as any)?.prompt ?? "";
        const grades = await gradeChange({ id: r.caseId, prompt, tags: r.tags }, { changes: out.changes ?? [], patch: out.patch, summary: out.summary, workspace: out.workspace }, o.rules, o.judges);
        for (const g of grades) next.costUsd += g.costUsd ?? 0;
        next.grades.push(...grades);
      }
      runs.push(next);
      o.onTask?.(next);
    }
  }
  return { summary: summarize(o.suiteName ?? sources[0]?.summary.suite ?? "agent", runs, startedAt, 1, o.threshold, o.label), runs };
}
