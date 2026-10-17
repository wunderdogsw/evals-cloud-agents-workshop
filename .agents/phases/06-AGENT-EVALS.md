# Phase 6 — Evaluate the coding agent

## Overview

Public benchmarks tell you how an agent does on other people's code. You'll build a small benchmark from changes that actually landed in *your* repo: start from the commit before, give the agent the task, then grade with the tests that came with the real change — tests the agent never sees. Tomorrow you'll delegate to cloud agents; today you find out what they can do here.

---

## 6.1 [BRANCH] Get tasks

- **Target is `sample` / catch-up** →

  ```bash
  pnpm workshop install <name> agent-tasks
  ```

  Tasks land in `.workshop/targets/<name>/agent-tasks/tasks.jsonl` (that's `<tasks-file>` below), with hidden tests and reference solutions next to them — outside the target. Agents work in throwaway snapshots under the system temp dir, far from both. Go to 6.3.

- **Own repo** → mine candidates (6.2).

## 6.2 [LLM] Mine candidates from history

Pick a test command that runs **only** the hidden test files — `{files}` expands to them. Examples: `npx vitest run {files}`, `pytest {files}`, `dotnet test --filter …` (for .NET, filter by the test class names instead — explain the trade-off).

```bash
pnpm agent-evals mine targets/<name> --test-command "<cmd with {files}>" --since "12 months ago" --limit 30 \
  --out .workshop/targets/<name>/tasks.candidates.jsonl
```

Show the candidate list (id, files, lines changed, subject). If the facilitators committed curated tasks to `kit/profiles/<name>.tasks.jsonl`, offer those instead.

## 6.3 [HUMAN] Curate 5–10 tasks

For own-repo candidates, they pick 5–10 and **rewrite each `prompt` as an issue a colleague would file** — the problem and acceptance criteria, not the solution, not the commit message. Remove the `meta` field. Save as `.workshop/targets/<name>/tasks.jsonl` (that's `<tasks-file>` below). Prefer tasks that are small, self-contained, and whose tests check behaviour rather than implementation details.

For the sample, they read the 5 provided prompts and may sharpen one.

## 6.4 [LLM] Validate the tasks

```bash
pnpm agent-evals validate targets/<name> --tasks <tasks-file> --setup "<install command>"
```

Every task must **fail at base** (otherwise it measures nothing) and **pass with the reference** (otherwise the hidden tests depend on something the task doesn't describe, or the env is broken). Drop or fix ❌ tasks. Report: N tasks kept.

## 6.5 [LLM] Run the agent

Confirm usage first: this runs on their Claude subscription and is the heaviest part of the day (each task is a full agent session; `--max-budget-usd` caps the API-equivalent estimate per task). This takes 10–30 minutes — hand the participant the command to run in their own terminal (or run it in the background):

Use whichever agent CLI they have — `claude` (Claude Code) or `cursor` (Cursor CLI, `agent`). Same harness, same tasks, same grading:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install>" \
  --max-budget-usd 2 --concurrency 2 --label <agent>-baseline
```

While it runs, explain what's happening: history-free snapshot (no `git log` cheating), the agent reads the target's CLAUDE.md/AGENTS.md, works, then hidden tests are copied in and run.

## 6.6 [HUMAN] Read what the agent did

Results: pass rate, cost, per-task (`.eval-runs/` in the control room). The run prints where workspaces are kept (system temp dir, `workshop-agent-runs/<agent>-baseline/<task>-<agent>/`). They open **one pass and one fail** and run `git diff eval-base` there. For the failure: wrong understanding of the task, missing repo knowledge, flailing, or a task that's unfair? Write one line per task in `.workshop/targets/<name>/agent-notes.md`.

## 6.7 [LLM] Optional: second opinion and second agent

- Add an LLM judge over the diff: write a short `.workshop/targets/<name>/diff-rubric.md` (scope creep, tests added, follows conventions) and re-run with `--judge .workshop/targets/<name>/diff-rubric.md --label claude-judged`.
- If they have both CLIs: run the other agent with the same tasks (`--label <other>-baseline`), then `pnpm evals compare claude-baseline cursor-baseline`. Same tasks, same hidden tests — a fair head-to-head on their own code.

## Gate 6

- [ ] ≥ 5 validated tasks in the tasks file
- [ ] One completed agent run (`claude` or `cursor`) with pass rate reported
- [ ] `agent-notes.md` has a line per task

## Room Gate 6

End of Day 1. Facilitators will put pass rates per target on screen. Wait for release.

---

## Phase Complete

Mark Phase 6 complete. Preview: "Tomorrow, Phase 7 — the agent stops running on your laptop. An issue goes in, a merge request comes out."
