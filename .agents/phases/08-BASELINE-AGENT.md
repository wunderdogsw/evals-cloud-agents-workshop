# Phase 8 — Baseline the agent

## What you do

1. **Run the agent with your setup** — run `pnpm agent-evals run` on your tasks with Claude Code or Cursor, in the background.
2. **Run it again without** — run the same tasks with every agent file removed and Claude Code in `--safe-mode`.
3. **Read what it did** — for each task, read both diffs and write the rules each run broke, one line per task in `agent-notes.md`.

## Gate

- [ ] Two completed runs, with and without the setup, each with a pass rate.
- [ ] `agent-notes.md` has a line per task naming the rules each run broke.

## Learning point

The hidden tests show whether the code works. The run without the setup shows how much your setup changes what the agent does.

## Wanted outcome

You have two baseline runs (first measurements to compare later results with), `baseline-with` and `baseline-without`, and notes for each task that Phases 9–11 grade and label.

---

## 8.1 Run the agent with your setup

### [LLM]

> Narrate: "We run the same tasks twice. One run has everything you built in Phases 4–5. The other run has none of it."

First, confirm the cost with them in one line. Each task is a full agent session on their own login. The whole run takes 10–30 minutes. `--max-budget-usd` sets the maximum estimated spend for each task.

Explain in three lines what the eval tool does:
- Every task starts from a copy of the files at its base commit, without git history.
- The tool copies in the agent files committed at the target's HEAD, so even old tasks run with today's setup.
- The agent never sees `evals/suites/agent/`. Claude Code runs with project and local settings only, so their personal `~/.claude` settings are not used.

Give them the command to run in their own terminal, because it is long. Use `<tasks-file>` and the install command from Phase 7:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --label baseline-with
```

### [HUMAN]

They start the run and wait for the first task to finish. The output shows `✓` or `✗` with its time and cost. Then they start 8.2 in a second terminal. The two runs use separate workspaces.

### [BRANCH]

- **A run fails to start or runs longer than 30 minutes** → stop it. On the sample, `pnpm workshop catchup 9` gives them a baseline that a facilitator recorded. On their own repo, reduce the tasks file to the 3 smallest tasks and run again.
- **They use Cursor** → `--agent cursor` needs `CURSOR_API_KEY` in their shell, never in a file. Tell them that Cursor has no flag to turn off customisations. Their Cursor user rules still apply in both runs.

## 8.2 Run it again without

### [LLM]

Explain `--without-setup`. It removes `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/` and `.mcp.json` from every workspace, in every folder. It also starts Claude Code with `--safe-mode`. Safe mode turns off CLAUDE.md, skills, hooks, MCP servers, plugins and auto memory. Built-in tools and permissions still work. The project's own `.claude/settings.json` is removed with the other files, so its permissions are gone. The eval tool's own allow list applies instead.

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --without-setup --label baseline-without
```

### [HUMAN]

They start it in the second terminal. While both runs work, they write a prediction in `agent-notes.md`: which tasks will give different results in the two runs, and why.

### [BRANCH]

- **Claude Code rejects `--safe-mode` in headless mode** → run `claude update`, then run again with `--agent claude` and the same label. If it still fails, tell the facilitator. A run with the files removed but without safe mode still gives a valid comparison for project rules.

## 8.3 Read what it did

### [LLM]

When both runs are done, show the comparison:

```bash
pnpm evals compare baseline-without baseline-with
```

Each run printed the location of its workspaces (`workshop-agent-runs/<label>/<task>-<agent>/` in the system temp folder). Show how to read one change: `git -C <workspace> diff eval-base --stat`, then the full diff.

### [HUMAN]

For **every task**, they open both diffs and write one line in `.workshop/targets/<name>/agent-notes.md`:

```text
<task>: with — pass/fail, broke R3 (no test file); without — fail, edited data/ (R4)
```

They compare the results with their prediction from 8.2. If the two runs give the same result for a task, they write down the reason. Either the setup made no difference for that task, or the task did not involve any rule.

Don't fill the notes for them. Pick one task they marked "no rule broken" and ask: did they check every picked rule against the diff?

## 8.4 Gate check

The participant confirms each item, and you verify it:

- [ ] Two completed runs, with and without the setup, each with a pass rate. — `ls .eval-runs | grep baseline-` shows both, and the compare output from 8.3
- [ ] `agent-notes.md` has a line per task naming the rules each run broke. — compare the task ids in `.workshop/targets/<name>/agent-notes.md` with the tasks file

---

## Phase Complete

Mark Phase 8 complete. Preview: "Phase 9 — turn the rules you checked by reading the diffs into code graders, and score both runs for each rule without running the agent again."
