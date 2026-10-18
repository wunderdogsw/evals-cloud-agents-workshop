# Phase 19 — Capstone: parallel agents, evidence-based merge

## Overview

You run several agents at the same time on a small backlog. Then you decide which MRs/PRs to merge. Each one is checked by the CI pipeline, the tests, your rules, the review agent and your own review. The question is not "can agents write code". The question is: "what would you need to see before you merge their work without rewriting it?"

---

## 19.1 [HUMAN] Pick the backlog

They pick 3–5 issues. Sample: the remaining `BACKLOG.md` items, including at least one with an open answer (6 or 7). Own repo: real small issues, or the Phase 7 tasks written as issues. Each issue gets acceptance criteria.

## 19.2 [HUMAN] Assign and launch

They decide which agent gets which issue and why, one line each in `agent-notes.md`, within the agreed budget. They can use any mix of `pnpm workshop delegate` (Claude Code or Cursor CLI, one terminal each), Cursor cloud agents, and Claude Code cloud sessions for GitHub repos. Every agent starts from the workshop branch and opens its MR/PR into it. They start all agents, then leave the keyboard for a few minutes. Working on something else while the agents run is the point of this phase.

## 19.3 [LLM] Collect evidence

When the MRs/PRs are open, run a reviewer on each (`pnpm workshop review <name> <branch>`, or read Bugbot's comments). Then build a table in `agent-notes.md` from what you can read: CI status (tests, and the agent eval gate: pass or stale), rules broken, review findings, and diff size from `git diff --stat`:

| Issue | Agent + where | CI | Rules broken | Review findings | Diff size |
|---|---|---|---|---|---|

Do not recommend what to merge. That decision is theirs.

## 19.4 [HUMAN] Triage

For each MR/PR they choose **merge**, **request changes** or **close**, with one reason. They merge the ones they would really merge, into the workshop branch only (confirm before you do anything). Nothing goes to the default branch. For one "request changes", they ask an agent for one more round (a follow-up `delegate`, a message to the cloud agent, or their editor's assistant) and check whether the result is now good enough.

## 19.5 [HUMAN] Retro

Three questions, with short answers, in `agent-notes.md`:

1. Which kind of task would you give to a cloud agent next week, and which kind never?
2. What is missing from your evals and tests before you could trust agent MRs more?
3. Which one change to your repo (instructions, tests, CI) will you make next week?

## Gate 19

- [ ] At least 3 agent MRs/PRs decided (merge, request changes or close), each with a reason
- [ ] The three retro questions are answered

---

## Phase Complete

Mark Phase 19 complete. Congratulate them briefly. Remind them what is now in their repo: checked agent instructions, a hook, rule graders, judge rubrics checked against their labels, a CI gate for the agent setup, a review agent, and agent tasks from their own history. Everything is still on `dev-days-workshop/*` branches; their default branch hasn't changed. If they want to keep parts, they open an MR into their default branch themselves, through their team's normal review. You don't do it for them.

Then run the cleanup as a dry run and walk through the list with them:

```bash
pnpm workshop cleanup <name>
```

Run it with `--yes` only when they confirm, and only for what they want removed. Their workshop branches can stay as long as they need them. The cleanup works at any time.
