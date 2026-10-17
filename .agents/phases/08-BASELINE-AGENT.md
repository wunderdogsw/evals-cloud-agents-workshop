# Phase 8 — Baseline the agent

## What you do

1. **Run the agent with your setup** — `pnpm agent-evals run` on your tasks, with Claude Code or Cursor, in the background.
2. **Run it again without** — the same tasks with every agent file removed and Claude Code in `--safe-mode`.
3. **Read what it did** — per task, both diffs and the rules each one broke, one line each in `agent-notes.md`.

## Gate

- [ ] Two completed runs, with and without the setup, each with a pass rate.
- [ ] `agent-notes.md` has a line per task naming the rules each run broke.

## Learning point

Hidden tests say whether the code works. The run without the setup says what your setup adds.

## Wanted outcome

Two baseline runs, `baseline-with` and `baseline-without`, plus notes per task that Phases 9–11 grade and label.

---

## 8.1 Run the agent with your setup

### [LLM]

> Narrate: "Same tasks, two runs: one with everything you built in Phases 4–5, one with none of it."

Confirm usage first, in one line: each task is a full agent session on their own login, 10–30 minutes for the whole run, and `--max-budget-usd` caps each task's estimated spend.

Explain what the harness does, in three lines: every task starts from a history-free snapshot of its base commit; the agent files committed at the target's HEAD are put in, so even old tasks run with today's setup; `evals/suites/agent/` is never shown to the agent. Claude Code runs with project and local settings only, so their personal `~/.claude` stays out.

Hand them the command to run in their own terminal (it's long), with `<tasks-file>` and the install command from Phase 7:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label baseline-with
```

### [HUMAN]

They start the run and watch the first task finish (`✓` or `✗` with its time and cost). Then they start 8.2 in a second terminal; the runs don't share workspaces.

### [BRANCH]

- **A run fails to start or lags past 30 minutes** → stop it. On the sample, `pnpm workshop catchup 9` brings a facilitator-recorded baseline; on their own repo, cut the tasks file to the 3 smallest tasks and run again.
- **They use Cursor** → `--agent cursor` needs `CURSOR_API_KEY` in their shell, never in a file. Tell them that Cursor has no flag to turn customisations off, so their Cursor user rules still apply in both runs.

## 8.2 Run it again without

### [LLM]

Explain `--without-setup`: it removes `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/` and `.mcp.json` from every workspace, at any depth, and starts Claude Code with `--safe-mode`, which turns off CLAUDE.md, skills, hooks, MCP servers, plugins and auto memory. Built-in tools and permissions still work. The project's own `.claude/settings.json` permissions are gone with the files, so the harness's own allow list applies.

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --without-setup --label baseline-without
```

### [HUMAN]

They start it in the second terminal. While both runs work, they write down a prediction in `agent-notes.md`: which tasks will differ between the two runs, and why.

### [BRANCH]

- **Claude Code rejects `--safe-mode` in headless mode** → re-run with `--agent claude` and the same label after `claude update`. If it still fails, tell the facilitator; the run without the files alone is still a fair comparison for project rules.

## 8.3 Read what it did

### [LLM]

When both runs are done, show the comparison:

```bash
pnpm evals compare baseline-without baseline-with
```

Each run printed where its workspaces are (`workshop-agent-runs/<label>/<task>-<agent>/` in the system temp folder). Show how to read one change: `git -C <workspace> diff eval-base --stat`, then the full diff.

### [HUMAN]

For **every task**, they open both diffs and write one line in `.workshop/targets/<name>/agent-notes.md`:

```text
<task>: with — pass/fail, broke R3 (no test file); without — fail, edited data/ (R4)
```

They check their prediction from 8.2. Where the two runs don't differ, they say whether the setup didn't matter for that task or the task didn't touch any rule.

Don't fill the notes for them. Ask about one task they marked "no rule broken": did they check every picked rule against the diff?

## 8.4 Gate check

The participant confirms, and you verify:

- [ ] Two completed runs, with and without the setup, each with a pass rate. — `ls .eval-runs | grep baseline-` shows both, and the compare output from 8.3
- [ ] `agent-notes.md` has a line per task naming the rules each run broke. — compare the task ids in `.workshop/targets/<name>/agent-notes.md` with the tasks file

---

## Phase Complete

Mark Phase 8 complete. Preview: "Phase 9 — turn the rules you checked by eye into code graders, and score both runs per rule without running the agent again."
