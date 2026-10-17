# Phase 10 — Capstone: parallel agents, evidence-based merge

## Overview

You'll run several cloud agents in parallel on a small backlog, then act as the merge gatekeeper: every MR/PR is judged by the eval gate, tests, the review agent, and your own review. The question isn't "can agents write code" — it's "what would it take for you to merge their work without rewriting it?"

---

## 10.1 [HUMAN] Pick the backlog

3–5 issues. Sample: the remaining `BACKLOG.md` items, including at least one open-ended one (6 or 7). Own repo: real small issues, or the Phase 6 tasks phrased as issues. Each issue gets acceptance criteria.

## 10.2 [HUMAN] Assign and launch

They decide which agent gets which issue and why (one line each in `agent-notes.md`), within the agreed budget — any mix of `pnpm workshop delegate` (Claude Code or Cursor CLI, one terminal each), Cursor cloud agents, and Claude Code cloud sessions for GitHub repos. Launch them all, then step away from the keyboard for a few minutes. That's the point.

## 10.3 [LLM] Collect evidence

When the MRs/PRs are up, run a reviewer on each (`pnpm workshop review <name> <branch>`, or read Bugbot's comments), then build a table in `agent-notes.md` from what you can read (eval gate status — pass / stale / below threshold, review findings, diff size via `git diff --stat`):

| Issue | Agent + where | Eval gate | Tests | Review findings | Diff size |
|---|---|---|---|---|---|

Do not give a merge recommendation. That's theirs.

## 10.4 [HUMAN] Triage

For each MR/PR: **merge**, **request changes**, or **close**, with one reason. Merge the ones they'd genuinely merge (confirm before you do anything). Iterate once on a "request changes" via an agent (a follow-up `delegate`, a message to the cloud agent, or their editor's assistant) and see if it converges.

## 10.5 [HUMAN] Retro

Three questions, short answers, in `agent-notes.md`:

1. Which kind of task would you delegate to a cloud agent on Monday — and which never?
2. What's missing from your evals/tests that would let you trust agent MRs more?
3. One change to your repo (instructions, tests, CI) you'll actually make next week.

## Gate 10

- [ ] ≥ 3 agent MRs/PRs triaged with a reason each
- [ ] Retro answered

---

## Phase Complete

Mark Phase 10 complete. Congratulate them briefly. Remind them what they're leaving with in their repo: an eval suite with a calibrated judge, a CI gate, agent instructions, a review agent, and a benchmark of agent tasks from their own history. Suggest they open one MR to their real (non-mirror) repo with the parts worth keeping.
