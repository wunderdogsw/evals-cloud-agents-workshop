# Phase 18 — Guardrails

## Overview

Phases 4–5 set up the agent's instructions, and Phases 8–15 measured them. Now you add two things for agents that work without a person watching: a "definition of done" section in AGENTS.md, and a review agent that comments on every MR/PR using your repo's rules. Then you run the Phase 8 tasks again to check that the new section didn't make the agent worse.

---

## 18.1 [HUMAN] Read the notes

They read `agent-notes.md` (Phases 8, 16 and 17) again and list the 3 most common reasons the agents went wrong in *their* repo. Examples: a missing command, an unknown convention, changes outside the issue, edits to protected files, tests in the wrong place.

## 18.2 [LLM] Add the agent section

```bash
pnpm workshop install <name> agents-section
```

It adds a section to AGENTS.md for agents that work alone: the install, build and test commands from the profile, a definition of done, and limits on what the agent may change. It also makes sure `CLAUDE.md` imports `@AGENTS.md`. Phase 4 should already have done that; if it hadn't, say so.

## 18.3 [HUMAN] Make it specific

They edit the section so it answers their 3 reasons from 18.1. Each line is a concrete rule, not an adjective: "Tests go next to the code in `X.test.ts`", not "write good tests". They replace the `TODO:` line under *Boundaries*. The whole section stays under about 40 lines, because agents follow long instruction files less reliably.

## 18.4 [LLM] Measure

They commit the AGENTS.md change on the workshop branch. Every task runs with the agent files committed at the target's HEAD, so the next run uses the new section, also for mined tasks with old base commits.

Run the same agent and settings as in Phase 12, with the graders and judges, and compare with the Phase 12 result:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "<install command>" \
  --max-budget-usd 2 --concurrency 2 --rules targets/<name>/evals/suites/agent/rules.mjs \
  --judge R5=targets/<name>/evals/suites/agent/rubric-r5.md --label guarded
pnpm evals compare change-1 guarded
```

Use one `--judge` per judge rule. Read the result as in Phase 13: the per-grader section first, then the pass rate and the cost. With 5–10 tasks a difference of one task can be random; say so.

The new section changed AGENTS.md, so the `workshop-agent-evals` job now fails as stale. They record again as in Phase 14 if they keep the change.

## 18.5 [LLM] Review agent

```bash
pnpm workshop install <name> review-md
```

`REVIEW.md` tells any review agent what to check in this repo: correctness, tests, changes to `evals/suites/agent/`, the rules in AGENTS.md, CLAUDE.md and `.claude/rules/`, and scope. They add their own picked rules from `expectations.md` to it and commit it. Then they run a reviewer on the Phase 16 or 17 MR/PR:

- **Any tool, from the laptop:** `pnpm workshop review <name> <agent-branch>` runs Claude Code or the Cursor CLI in read-only mode on the diff and prints the review. Add `--post` to post it on the MR/PR with their `glab`/`gh` login (confirm first).
- **Cursor Bugbot:** turn it on for the repo in the Cursor dashboard (*Bugbot*, per repo; works on GitLab and GitHub). It reviews every MR/PR automatically, with no CI setup.

(Only where the organisation allows a model credential in CI: `ci-review` adds a Claude review job to the pipeline. This workshop doesn't use it.)

## 18.6 [HUMAN] Review the reviewer

Did the review agent find what they found in Phase 16 or 17? What did it miss? Which comments were not useful? They write one line in `agent-notes.md`. If the review has too many useless comments, they make `REVIEW.md` more specific.

## Gate 18

- [ ] AGENTS.md has a project-specific agent section, and CLAUDE.md imports AGENTS.md
- [ ] A new agent run exists, compared with the Phase 12 run
- [ ] A review agent posted or printed at least one review

## Room Gate 18

Before the capstone, the room agrees on a budget per person. Wait until the facilitators release the room.

---

## Phase Complete

Mark Phase 18 complete. Preview: "Phase 19 — several agents work at the same time, and you decide what to merge based on the evidence."
