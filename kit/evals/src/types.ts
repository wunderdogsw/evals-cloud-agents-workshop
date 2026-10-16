/** One row of a dataset. `input` goes to the task; `expected` is what graders compare against. */
export interface EvalCase<I = unknown, E = unknown> {
  id: string;
  input: I;
  expected?: E;
  /** Free-form labels used for per-slice reporting and `--tag` filtering (e.g. "edge", "finnish", "regression"). */
  tags?: string[];
  /** Optional note to the reader: why this case exists. Not used by graders. */
  note?: string;
}

export interface GradeResult {
  /** Grader name — stable across runs so `compare` can line results up. */
  name: string;
  /** 0..1 */
  score: number;
  pass: boolean;
  reason?: string;
  /** Cost in USD if the grader called a model. */
  costUsd?: number;
}

export interface GraderContext<I = unknown, E = unknown, O = unknown> {
  case: EvalCase<I, E>;
  output: O;
}

export interface Grader<I = unknown, E = unknown, O = unknown> {
  name: string;
  grade(ctx: GraderContext<I, E, O>): Promise<GradeResult> | GradeResult;
}

export interface TaskResult<O = unknown> {
  output: O;
  /** Optional cost/latency metadata the task wants reported. */
  costUsd?: number;
  meta?: Record<string, unknown>;
}

export type Task<I = unknown, O = unknown> = (input: I, ctx: { caseId: string; trial: number }) => Promise<O | TaskResult<O>>;

export interface Threshold {
  /** Minimum fraction of cases where *all* graders pass. */
  passRate?: number;
  /** Minimum mean score per grader, keyed by grader name (as shown in the summary table). */
  graders?: Record<string, number>;
  /** Minimum pass rate per tag, e.g. { critical: 1 } — every case tagged "critical" must pass. */
  tags?: Record<string, number>;
}

export interface Suite<I = unknown, E = unknown, O = unknown> {
  name: string;
  /** Path to a .jsonl file (relative to the suite file) or inline cases. */
  cases: string | EvalCase<I, E>[];
  task: Task<I, O>;
  graders: Grader<I, E, O>[];
  threshold?: Threshold;
  /** Parallel cases. Default 4. */
  concurrency?: number;
  /** Run each case N times to measure consistency. Default 1. */
  trials?: number;
}

export interface CaseRun {
  caseId: string;
  trial: number;
  tags: string[];
  input: unknown;
  expected?: unknown;
  output?: unknown;
  error?: string;
  grades: GradeResult[];
  pass: boolean;
  durationMs: number;
  costUsd: number;
}

export interface GraderSummary {
  name: string;
  meanScore: number;
  passRate: number;
}

export interface RunSummary {
  suite: string;
  startedAt: string;
  finishedAt: string;
  cases: number;
  trials: number;
  passRate: number;
  graders: GraderSummary[];
  byTag: Record<string, { cases: number; passRate: number }>;
  errors: number;
  totalCostUsd: number;
  threshold?: Threshold;
  thresholdMet?: boolean;
  thresholdFailures?: string[];
  /** Free-form label, e.g. git sha or "prompt-v2". */
  label?: string;
}

export interface RunResult {
  summary: RunSummary;
  runs: CaseRun[];
}
