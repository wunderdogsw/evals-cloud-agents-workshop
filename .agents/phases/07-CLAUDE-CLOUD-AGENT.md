# Phase 7 — Claude as a cloud agent

## Overview

You'll hand a task to Claude running in your CI — not on your laptop — and get back a merge/pull request that your Day 1 eval gate checks. You'll write the task as an issue, trigger the agent, and review what comes back like you'd review a colleague's work.

---

## 7.1 [LLM] Resume check

Read the profile. Confirm the default branch has `evals/` and the eval CI job (Gate 5). If not, stop and fix that first — or `pnpm workshop catchup 7` and push the new target (Phase 5, *No remote yet*).

## 7.2 [BRANCH] Install the agent

**GitLab** — Claude Code runs as a CI job (beta integration, maintained by GitLab):

```bash
pnpm workshop install <name> ci-claude
```

Explain the job in 4 bullets: triggered by a manual/API pipeline with `ISSUE_IID` or `CLAUDE_TASK`; installs Claude Code; runs `claude -p` with `acceptEdits` and a turn + budget cap; pushes a `claude/…` branch and opens an MR with push options. Note: `@claude` comment triggers need a webhook listener — not part of today.

The participant creates a **project access token** (*Settings → Access tokens*, role Developer, scopes `api` + `write_repository`) and stores it as masked CI variable `GITLAB_ACCESS_TOKEN`.

**GitHub** — two options; do (a), mention (b):

(a) The Claude GitHub Action:

```bash
pnpm workshop install <name> ci-claude
```

They install the Claude GitHub App on the repo (or run `/install-github-app` in Claude Code). `ANTHROPIC_API_KEY` secret is already there from Phase 5.

(b) Claude Code on the web: a cloud session at claude.ai/code (or `claude --cloud "<task>"`) clones the GitHub repo in an Anthropic-hosted VM and can open the PR. Only GitHub repos can push back this way.

Commit the job, push, merge to the default branch (confirm first) — the agent must exist on the branch it starts from.

## 7.3 [HUMAN] Write the issue

They file an issue in GitLab/GitHub. For `cost-coder`, pick one from `BACKLOG.md` (items 1–5 match the Phase 6 tasks — good for comparing). For their own repo, a small, real backlog item.

Coach the issue, briefly: problem, acceptance criteria, constraints ("don't change the eval dataset"), where to look. Not the solution.

## 7.4 [LLM] Trigger

Confirm, then trigger:

- **GitLab**: *Build → Pipelines → Run pipeline* on the default branch with variable `ISSUE_IID=<n>`, or `glab ci run -b <default> --variables ISSUE_IID:<n>`.
- **GitHub**: comment `@claude implement this` on the issue. Claude pushes a branch and replies with a "Create PR" link — click it.

While it runs (5–15 min): look at the job log together. Point out the turn count, the tools it uses, when it runs tests.

## 7.5 [HUMAN] Review the MR/PR

They review as they would a colleague's: does it solve the issue, is the scope right, tests, conventions. Check the eval job result on the MR/PR. For the sample, also run the hidden tests for the matching Phase 6 task against the agent's branch:

```bash
cd targets/<name> && git fetch && git checkout <agent-branch>
cp -r ../../.workshop/targets/<name>/agent-tasks/hidden/<task-id>/. . && pnpm exec vitest run test/hidden; git checkout -- . && git clean -fd test/hidden
git checkout workshop/<participant>
```

They leave at least one review comment. On GitHub, `@claude` in a review comment iterates on the PR — try it once. On GitLab, run the pipeline **on the agent's `claude/…` branch** with `CLAUDE_TASK="Address review: …"` — the job reuses that branch and updates the same MR.

## Gate 7

- [ ] An agent-authored MR/PR exists and its eval job ran
- [ ] The participant reviewed it and recorded a verdict (merge / change / reject) with one reason in `.workshop/targets/<name>/agent-notes.md`

---

## Phase Complete

Mark Phase 7 complete. Preview: "Phase 8 — same kind of task, different agent: Cursor's cloud agents."
