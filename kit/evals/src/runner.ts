import { isAbsolute, resolve } from "node:path";
import { loadCases } from "./dataset.ts";
import type { CaseRun, EvalCase, GradeResult, RunResult, RunSummary, Suite, TaskResult, Threshold } from "./types.ts";

export function defineSuite<I = any, E = any, O = any>(suite: Suite<I, E, O>): Suite<I, E, O> {
  return suite;
}

export interface RunOptions {
  /** Directory relative paths in `suite.cases` resolve against (the suite file's dir). */
  baseDir?: string;
  tags?: string[];
  ids?: string[];
  limit?: number;
  trials?: number;
  concurrency?: number;
  label?: string;
  onCase?: (run: CaseRun) => void;
  /**
   * Re-grade outputs from an earlier run instead of calling the task (keyed "caseId#trial").
   * Use when you change graders or the rubric: same outputs, so human labels still apply.
   */
  reuseOutputs?: Map<string, { output?: unknown; error?: string }>;
}

function isTaskResult<O>(v: unknown): v is TaskResult<O> {
  return typeof v === "object" && v !== null && "output" in v && Object.keys(v).every((k) => ["output", "costUsd", "meta"].includes(k));
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (i < items.length) {
      const item = items[i++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function resolveCases<I, E>(suite: Suite<I, E, any>, baseDir = process.cwd()): Promise<EvalCase<I, E>[]> {
  if (Array.isArray(suite.cases)) return suite.cases;
  const p = isAbsolute(suite.cases) ? suite.cases : resolve(baseDir, suite.cases);
  return loadCases<I, E>(p);
}

export async function runSuite<I, E, O>(suite: Suite<I, E, O>, opts: RunOptions = {}): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  let cases = await resolveCases(suite, opts.baseDir);
  if (opts.ids?.length) cases = cases.filter((c) => opts.ids!.includes(c.id));
  if (opts.tags?.length) cases = cases.filter((c) => c.tags?.some((t) => opts.tags!.includes(t)));
  if (opts.limit) cases = cases.slice(0, opts.limit);
  if (cases.length === 0) throw new Error("no cases selected — check the dataset path and filters");

  const trials = opts.trials ?? suite.trials ?? 1;
  const jobs = cases.flatMap((c) => Array.from({ length: trials }, (_, t) => ({ c, trial: t + 1 })));
  const runs: CaseRun[] = [];

  await pool(jobs, opts.concurrency ?? suite.concurrency ?? 4, async ({ c, trial }) => {
    const t0 = Date.now();
    const run: CaseRun = { caseId: c.id, trial, tags: c.tags ?? [], input: c.input, expected: c.expected, grades: [], pass: false, durationMs: 0, costUsd: 0 };
    try {
      const prev = opts.reuseOutputs?.get(`${c.id}#${trial}`);
      if (opts.reuseOutputs && !prev) throw new Error("no output to re-grade for this case in the source run");
      if (prev?.error) throw new Error(prev.error);
      const raw = prev ? (prev.output as O) : await suite.task(c.input, { caseId: c.id, trial });
      const output = isTaskResult<O>(raw) ? raw.output : (raw as O);
      if (isTaskResult<O>(raw)) run.costUsd += raw.costUsd ?? 0;
      run.output = output;
      for (const g of suite.graders) {
        let gr: GradeResult;
        try {
          gr = await g.grade({ case: c, output });
        } catch (e) {
          gr = { name: g.name, pass: false, score: 0, reason: `grader error: ${(e as Error).message}` };
        }
        run.costUsd += gr.costUsd ?? 0;
        run.grades.push(gr);
      }
      run.pass = run.grades.length > 0 && run.grades.every((g) => g.pass);
    } catch (e) {
      run.error = (e as Error).message;
      run.grades = suite.graders.map((g) => ({ name: g.name, pass: false, score: 0, reason: "task failed" }));
    }
    run.durationMs = Date.now() - t0;
    runs.push(run);
    opts.onCase?.(run);
  });

  runs.sort((a, b) => a.caseId.localeCompare(b.caseId) || a.trial - b.trial);
  const summary = summarize(suite.name, runs, startedAt, trials, suite.threshold, opts.label);
  return { summary, runs };
}

export function summarize(name: string, runs: CaseRun[], startedAt: string, trials: number, threshold?: Threshold, label?: string): RunSummary {
  const passRate = runs.length ? runs.filter((r) => r.pass).length / runs.length : 0;
  const graderNames = [...new Set(runs.flatMap((r) => r.grades.map((g) => g.name)))];
  const graders = graderNames.map((n) => {
    const gs = runs.map((r) => r.grades.find((g) => g.name === n)).filter(Boolean) as GradeResult[];
    return {
      name: n,
      meanScore: gs.reduce((s, g) => s + g.score, 0) / (gs.length || 1),
      passRate: gs.filter((g) => g.pass).length / (gs.length || 1),
    };
  });
  const byTag: RunSummary["byTag"] = {};
  for (const tag of new Set(runs.flatMap((r) => r.tags))) {
    const rs = runs.filter((r) => r.tags.includes(tag));
    byTag[tag] = { cases: rs.length, passRate: rs.filter((r) => r.pass).length / rs.length };
  }
  const summary: RunSummary = {
    suite: name,
    startedAt,
    finishedAt: new Date().toISOString(),
    cases: new Set(runs.map((r) => r.caseId)).size,
    trials,
    passRate,
    graders,
    byTag,
    errors: runs.filter((r) => r.error).length,
    totalCostUsd: runs.reduce((s, r) => s + r.costUsd, 0),
    label,
  };
  if (threshold) {
    const failures: string[] = [];
    if (threshold.passRate !== undefined && passRate < threshold.passRate)
      failures.push(`pass rate ${(passRate * 100).toFixed(1)}% < ${(threshold.passRate * 100).toFixed(1)}%`);
    for (const [g, min] of Object.entries(threshold.graders ?? {})) {
      const s = graders.find((x) => x.name === g);
      if (!s) failures.push(`grader "${g}" not found`);
      else if (s.meanScore < min) failures.push(`${g} mean ${s.meanScore.toFixed(3)} < ${min}`);
    }
    for (const [tag, min] of Object.entries(threshold.tags ?? {})) {
      const t = byTag[tag];
      if (!t) failures.push(`tag "${tag}" has no cases`);
      else if (t.passRate < min) {
        const failed = runs.filter((r) => r.tags.includes(tag) && !r.pass).map((r) => r.caseId);
        failures.push(`tag "${tag}" pass rate ${(t.passRate * 100).toFixed(1)}% < ${(min * 100).toFixed(1)}% (failing: ${[...new Set(failed)].join(", ")})`);
      }
    }
    summary.threshold = threshold;
    summary.thresholdMet = failures.length === 0;
    summary.thresholdFailures = failures;
  }
  return summary;
}

