import { model as defaultModel } from "@workshop/evals";
import { spawnArgs, tail } from "./sh.ts";
import type { AgentAdapter } from "./types.ts";

const RULES = `You are working on a task in an isolated copy of a repository.
- Work only inside the current directory. Do not push, do not open MRs/PRs.
- There is no human to answer questions: make reasonable assumptions and note them in your final message.
- Run the project's existing tests before you finish.
- Finish with a 2-3 sentence summary of what you changed.`;

/**
 * Claude Code in headless mode. Flags per https://code.claude.com/docs/en/headless :
 * acceptEdits auto-approves file edits; Bash is allowed explicitly so the agent can run tests.
 * Run this only in a throwaway workspace (the harness always does).
 */
export const claude: AgentAdapter = {
  name: "claude",
  async run({ cwd, prompt, timeoutMs, model, maxTurns, maxBudgetUsd, withoutSetup }) {
    // With the setup: project and local settings only, so the participant's own ~/.claude doesn't leak in.
    // Without: --safe-mode turns off CLAUDE.md, skills, hooks, MCP, plugins and auto memory
    // (https://code.claude.com/docs/en/cli-reference). The harness also strips the files from the workspace.
    const setup = withoutSetup ? ["--safe-mode"] : ["--setting-sources", "project,local"];
    const args = [
      ...setup,
      "-p",
      prompt,
      "--output-format",
      "json",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read,Edit,Write,Glob,Grep,Bash",
      "--append-system-prompt",
      RULES,
      "--model",
      model ?? defaultModel("agent"),
      "--max-turns",
      String(maxTurns ?? 40),
      "--no-session-persistence",
      ...(maxBudgetUsd ? ["--max-budget-usd", String(maxBudgetUsd)] : []),
    ];
    const r = await spawnArgs("claude", args, { cwd, timeoutMs });
    let parsed: any = {};
    try {
      parsed = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
    } catch {}
    return {
      ok: r.code === 0 && parsed.subtype === "success",
      exitCode: r.timedOut ? null : r.code,
      durationMs: r.durationMs,
      costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined,
      turns: parsed.num_turns,
      summary: typeof parsed.result === "string" ? parsed.result : parsed.subtype,
      log: tail(r.stdout + "\n" + r.stderr),
    };
  },
};

/** Cursor CLI in headless mode (https://cursor.com/docs/cli/headless). `--force` lets it write files. Needs CURSOR_API_KEY. */
export const cursor: AgentAdapter = {
  name: "cursor",
  async run({ cwd, prompt, timeoutMs, model }) {
    const full = `${RULES}\n\n${prompt}`;
    const r = await spawnArgs("agent", ["-p", full, "--force", "--trust", "--output-format", "json", ...(model ? ["--model", model] : [])], { cwd, timeoutMs });
    let parsed: any = {};
    try {
      parsed = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
    } catch {}
    return {
      ok: r.code === 0,
      exitCode: r.timedOut ? null : r.code,
      durationMs: r.durationMs,
      summary: typeof parsed.result === "string" ? parsed.result : undefined,
      log: tail(r.stdout + "\n" + r.stderr),
    };
  },
};

/** Does nothing. Baseline: hidden tests should FAIL — otherwise the task measures nothing. */
export const noop: AgentAdapter = {
  name: "noop",
  async run() {
    return { ok: true, exitCode: 0, durationMs: 0, log: "", summary: "no changes" };
  },
};

/** Applies a fixed patch instead of running a model. Used by `grade-patch` to prove rule graders. */
export function patchAgent(file: string): AgentAdapter {
  return {
    name: "patch",
    async run({ cwd }) {
      const r = await spawnArgs("git", ["apply", "--whitespace=nowarn", file], { cwd, timeoutMs: 60_000 });
      if (r.code !== 0) throw new Error(`git apply ${file} failed: ${r.stderr.trim()}`);
      return { ok: true, exitCode: 0, durationMs: r.durationMs, log: "", summary: `applied ${file}` };
    },
  };
}

export const AGENTS: Record<string, AgentAdapter> = { claude, cursor, noop };
