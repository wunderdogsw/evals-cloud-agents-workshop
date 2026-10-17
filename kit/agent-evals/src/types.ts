export interface AgentTask {
  id: string;
  /** Commit to start from. "HEAD" = the target's current commit. For mined tasks: the parent of the reference commit. */
  base: string;
  /** What the agent is told. Write it like an issue a colleague would file — not like the commit message. */
  prompt: string;
  /** Decides pass/fail after hidden tests are in place. Runs in the task workspace. */
  testCommand: string;
  /** Runs once in the fresh workspace before the agent (e.g. dependency install). Defaults to the profile's install command. */
  setupCommand?: string;
  /** Tests the agent never sees. Copied in after the agent finishes. */
  hiddenTests?: {
    /** Directory (relative to the tasks file) whose contents are copied onto the workspace root. */
    dir?: string;
    /** Take these paths from `fromCommit` (default: `reference`). */
    paths?: string[];
    fromCommit?: string;
  };
  /** The commit that actually solved this. Used by `validate`. */
  reference?: string;
  /** Alternative to `reference`: a directory (relative to the tasks file) holding a known-good solution, overlaid by `validate`. */
  referenceDir?: string;
  tags?: string[];
  timeoutMin?: number;
}

export interface AgentRunOutput {
  ok: boolean;
  exitCode: number | null;
  durationMs: number;
  costUsd?: number;
  turns?: number;
  summary?: string;
  log: string;
}

export interface AgentAdapter {
  name: string;
  run(opts: { cwd: string; prompt: string; timeoutMs: number; model?: string; maxTurns?: number; maxBudgetUsd?: number; withoutSetup?: boolean }): Promise<AgentRunOutput>;
}
