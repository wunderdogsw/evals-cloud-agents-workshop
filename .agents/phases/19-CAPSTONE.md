# Phase 19 — Capstone: parallel agents, evidence-based merge

## Overview

You'll run several cloud agents in parallel on a small backlog, then act as the merge gatekeeper: every MR/PR is judged by the eval gate, tests, the review agent, and your own review. The question isn't "can agents write code" — it's "what would it take for you to merge their work without rewriting it?"

---

## 19.1 [HUMAN] Pick the backlog

3–5 issues. Sample: the remaining `BACKLOG.md` items, including at least one open-ended one (6 or 7). Own repo: real small issues, or the Phase 7 tasks phrased as issues. Each issue gets acceptance criteria.

## 19.2 [HUMAN] Assign and launch

They decide which agent gets which issue and why (one line each in `agent-notes.md`), within the agreed budget — any mix of `pnpm workshop delegate` (Claude Code or Cursor CLI, one terminal each), Cursor cloud agents, and Claude Code cloud sessions for GitHub repos. Every agent starts from the workshop branch and opens its MR/PR into it. Launch them all, then step away from the keyboard for a few minutes. That's the point.

## 19.3 [LLM] Collect evidence

When the MRs/PRs are up, run a reviewer on each (`pnpm workshop review <name> <branch>`, or read Bugbot's comments), then build a table in `agent-notes.md` from what you can read (eval gate status — pass / stale / below threshold, review findings, diff size via `git diff --stat`):

| Issue | Agent + where | Eval gate | Tests | Review findings | Diff size |
|---|---|---|---|---|---|

Do not give a merge recommendation. That's theirs.

## 19.4 [HUMAN] Triage

For each MR/PR: **merge**, **request changes**, or **close**, with one reason. Merge the ones they'd genuinely merge into the workshop branch (confirm before you do anything); nothing goes to the default branch. Iterate once on a "request changes" via an agent (a follow-up `delegate`, a message to the cloud agent, or their editor's assistant) and see if it converges.

## 19.5 [HUMAN] Retro

Three questions, short answers, in `agent-notes.md`:

1. Which kind of task would you delegate to a cloud agent on Monday — and which never?
2. What's missing from your evals/tests that would let you trust agent MRs more?
3. One change to your repo (instructions, tests, CI) you'll actually make next week.

## Gate 19

- [ ] ≥ 3 agent MRs/PRs triaged with a reason each
- [ ] Retro answered

---

## Phase Complete

Mark Phase 19 complete. Congratulate them briefly. Remind them what they're leaving with in their repo: an eval suite with a calibrated judge, a CI gate, agent instructions, a review agent, and a benchmark of agent tasks from their own history. Everything is still on `dev-days-workshop/*` branches; their default branch hasn't changed. If they want to keep parts, they open an MR into their default branch themselves, through their team's normal review — you don't do it for them.

Then run the cleanup as a dry run and walk through the list with them:

```bash
pnpm workshop cleanup <name>
```

Run it with `--yes` only when they confirm, and only for what they want gone. Their workshop branches can stay as long as they're useful; the cleanup works any time.
