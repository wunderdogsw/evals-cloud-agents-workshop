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
  async run({ cwd, prompt, timeoutMs, model, maxTurns, maxBudgetUsd }) {
    const args = [
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

export const AGENTS: Record<string, AgentAdapter> = { claude, cursor, noop };
