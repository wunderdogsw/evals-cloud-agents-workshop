# Phase 16 — Delegate: issue in, merge request out

## Overview

You give a whole task to a coding agent and let it work alone. It gets a new branch, works without questions, commits, and opens a merge request or pull request (MR/PR). Your CI pipeline from Phase 14 runs on it. The agent runs in headless mode (no interactive UI) with your own Claude Code or Cursor login, and pushes with your own git credentials. Nothing new goes into CI. Then you review the MR/PR the way you review a colleague's work.

---

## 16.1 [LLM] Resume check

Read the profile. Check that the workshop branch `dev-days-workshop/<participant>` on the remote has `evals/suites/agent/last-run.json` and the `workshop-agent-evals` CI job (Gate 14). If not, stop and fix that first, or run `pnpm workshop catchup 16` and push the new target (Phase 14, *No remote yet*).

Check which agent CLIs are available and say so in one line:

```bash
claude --version 2>/dev/null; agent --version 2>/dev/null
```

Either tool works for everything in this phase. If both are installed, the participant can run one task with each and compare the results.

## 16.2 [HUMAN] Write the issue

They create an issue in GitLab or GitHub. For `cost-coder`, they pick one from `BACKLOG.md`. Items 1–5 match the Phase 7 tasks, so the results are easy to compare. For their own repo, they pick a small, real item from their backlog.

Help them write the issue, briefly: the problem, the acceptance criteria, the constraints ("don't change `evals/suites/agent/`") and where to look in the code. Don't write the solution into the issue.

## 16.3 [LLM] Delegate

Confirm first. Then give the participant this command to run **in their own terminal**. It runs for several minutes and prints progress as it goes:

```bash
pnpm workshop delegate <name> --issue <n>            # reads the issue via glab/gh
pnpm workshop delegate <name> --task-file issue.md   # or: the issue text in a file
# add --agent claude or --agent cursor to choose; default is whichever is installed
```

Explain what it does in five points:

- It creates a git worktree on a new `dev-days-workshop/<participant>-agent-<tool>-…` branch from the workshop branch. Their own checkout doesn't change.
- It runs Claude Code (`claude -p`, edits accepted automatically, Bash allowed) or the Cursor CLI (`agent -p --force`) in headless mode with the issue text, and tells the agent to follow AGENTS.md.
- It tells the agent not to edit `evals/suites/agent/`, to run `pnpm --dir evals verify suites/agent`, and to say so if it changed an agent file.
- It commits, pushes the branch through the push guard, and opens the MR (with GitLab push options) or the PR (`gh pr create`) **into the workshop branch**, never into the default branch.
- It prints the agent's summary and keeps the worktree so they can look at it.

While it runs, say: "A cloud agent does the same steps. The only difference is that it runs on another machine. Phase 17 moves the work off your laptop."

## 16.4 [HUMAN] Review the MR/PR

They review it the way they review a colleague's work: does it solve the issue, does it stay within the issue, are there tests, does it follow the repo's rules. They also check the picked rules from `expectations.md` against the diff, one rule at a time.

The `workshop-agent-evals` job checks only the agent setup, not the code. It fails as **stale** only if the agent changed an agent file (`CLAUDE.md`, `AGENTS.md`, `.claude/`, `.cursor/`). If that happened, they say so in the review.

For the sample, also run the hidden tests for the matching Phase 7 task against the agent's worktree (path printed by `delegate`):

```bash
cd <worktree> && cp -r <workshop repo>/.workshop/targets/<name>/agent-tasks/hidden/<task-id>/. . && pnpm exec vitest run test/hidden; git checkout -- . && git clean -fdq test/hidden
```

For the sample, they can also run the Phase 9 rule graders on the agent's change:

```bash
git -C <worktree> diff dev-days-workshop/<participant> > .workshop/targets/<name>/agent-change.diff
pnpm agent-evals grade-patch targets/<name> --tasks .workshop/targets/<name>/agent-tasks/tasks.jsonl --task <task-id> \
  --patch .workshop/targets/<name>/agent-change.diff --rules targets/<name>/evals/suites/agent/rules.mjs
```

They leave at least one review comment. Then they ask for one more round: `pnpm workshop delegate <name> --task "Address review on <branch>: …"` creates a follow-up branch. They can also check out the agent's branch and continue in their editor with any assistant. Both are fine. The goal is to see how much help the agent needed.

## Gate 16

- [ ] An MR/PR written by an agent exists, into the workshop branch, and its CI pipeline ran
- [ ] The participant reviewed it and recorded a verdict (merge / change / reject) with one reason in `.workshop/targets/<name>/agent-notes.md`

---

## Phase Complete

Mark Phase 16 complete. Preview: "Phase 17 — the same delegation, but the agent runs in the cloud instead of on your laptop."
