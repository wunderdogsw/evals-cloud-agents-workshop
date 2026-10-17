# Phase 7 — Delegate: issue in, merge request out

## Overview

You'll hand a whole task to a coding agent and walk away: it gets a fresh branch, works unattended, commits, and comes back as a merge/pull request that your Day 1 eval gate checks. It runs headless with your own Claude Code or Cursor login — whichever you have, or both — and pushes with your own git credentials, so nothing new goes into CI. Then you review it like a colleague's work.

---

## 7.1 [LLM] Resume check

Read the profile. Confirm the workshop branch `dev-days-workshop/<participant>` on the remote has `evals/`, `last-run.json` and the eval CI job (Gate 5). If not, stop and fix that first — or `pnpm workshop catchup 7` and push the new target (Phase 5, *No remote yet*).

Check which agent CLIs are available and say so in one line:

```bash
claude --version 2>/dev/null; agent --version 2>/dev/null
```

Either works for everything in this phase. If both are there, the participant can run one task with each and compare.

## 7.2 [HUMAN] Write the issue

They file an issue in GitLab/GitHub. For `cost-coder`, pick one from `BACKLOG.md` (items 1–5 match the Phase 6 tasks — good for comparing). For their own repo, a small, real backlog item.

Coach the issue, briefly: problem, acceptance criteria, constraints ("don't change the eval dataset"), where to look. Not the solution.

## 7.3 [LLM] Delegate

Confirm, then hand the participant this to run **in their own terminal** (it runs for several minutes and streams progress):

```bash
pnpm workshop delegate <name> --issue <n>            # reads the issue via glab/gh
pnpm workshop delegate <name> --task-file issue.md   # or: the issue text in a file
# add --agent claude or --agent cursor to choose; default is whichever is installed
```

Explain what it does in five bullets:

- creates a git worktree on a new `dev-days-workshop/<participant>-agent-<tool>-…` branch from the workshop branch — their own checkout is untouched;
- runs Claude Code (`claude -p`, edits auto-accepted, Bash allowed) or the Cursor CLI (`agent -p --force`) headless with the issue, told to follow AGENTS.md;
- tells the agent to run the eval gate (`pnpm verify`) before finishing and re-record if it touched the LLM feature;
- commits, pushes the branch through the push guard, and opens the MR (GitLab push options) or PR (`gh pr create`) **into the workshop branch**, never the default branch;
- prints the agent's summary and keeps the worktree for inspection.

While it runs: "This is the same loop a cloud agent runs — the only difference is whose machine it's on. Phase 8 moves it off yours."

## 7.4 [HUMAN] Review the MR/PR

They review as they would a colleague's: does it solve the issue, is the scope right, tests, conventions. Check the eval gate on the MR/PR — if it's red as **stale**, the agent changed the feature without re-recording; say so in the review.

For the sample, also run the hidden tests for the matching Phase 6 task against the agent's worktree (path printed by `delegate`):

```bash
cd <worktree> && cp -r <control-room>/.workshop/targets/<name>/agent-tasks/hidden/<task-id>/. . && pnpm exec vitest run test/hidden; git checkout -- . && git clean -fdq test/hidden
```

They leave at least one review comment, then iterate once: `pnpm workshop delegate <name> --task "Address review on <branch>: …"` creates a follow-up branch — or they check out the agent's branch and continue in their editor with whichever assistant they like. Either is fine; the point is noticing how much steering it needed.

## Gate 7

- [ ] An agent-authored MR/PR exists and its eval gate ran
- [ ] The participant reviewed it and recorded a verdict (merge / change / reject) with one reason in `.workshop/targets/<name>/agent-notes.md`

---

## Phase Complete

Mark Phase 7 complete. Preview: "Phase 8 — the same delegation, but the agent runs in the cloud instead of on your laptop."
