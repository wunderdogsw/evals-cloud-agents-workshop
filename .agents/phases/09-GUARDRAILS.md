# Phase 9 — Guardrails

## Overview

Agents follow the instructions they find in the repo. You'll write an agent-facing section in AGENTS.md (and CLAUDE.md), add a review agent to every MR/PR, then re-run Phase 6's benchmark to see if your instructions changed the pass rate. Instructions you haven't measured are just hopes.

---

## 9.1 [HUMAN] Mine the notes

They re-read `agent-notes.md` (Phases 6–8) and list the 3 most common reasons agents went wrong in *their* repo: missing commands, unknown conventions, scope creep, touching evals, wrong test location…

## 9.2 [LLM] Add the agent section

```bash
pnpm workshop install <name> agents-section
```

Commands are filled from the profile. The script also makes sure `CLAUDE.md` imports `@AGENTS.md` (Claude Code reads CLAUDE.md; Cursor reads AGENTS.md) — mention it, because without it Phase 6 measured Claude without these instructions.

## 9.3 [HUMAN] Make it specific

They edit the section to address their 3 reasons from 9.1 — concrete rules, not adjectives ("Tests live next to the code in `X.test.ts`", not "write good tests"). Replace the `TODO:` line under *Boundaries*. Keep the whole section under ~40 lines: long instruction files get skimmed by agents too.

## 9.4 [LLM] Measure

Commit the AGENTS.md change on the workshop branch (the benchmark snapshots `base` commits, so the new instructions must be in the snapshot):

- **Sample tasks** (`base: "HEAD"`) → just commit; the next run picks it up.
- **Mined tasks** (`base` = old parent commits) → the old commits don't have the new AGENTS.md. Explain the trade-off and copy the new file in with `setupCommand`, e.g. `--setup "<install> && cp <abs path to new AGENTS.md> AGENTS.md && git add AGENTS.md"` (setup runs before the `eval-base` tag, so it isn't counted as the agent's diff).

Then re-run with the same settings as Phase 6 and compare:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent claude --setup "…" --max-budget-usd 2 --label claude-guarded
pnpm evals compare <claude-baseline run dir> latest
```

Read it like Phase 4: fixes, regressions, cost, noise (5–10 tasks is a small sample — say so).

## 9.5 [LLM] Review agent

```bash
pnpm workshop install <name> review-md
pnpm workshop install <name> ci-review
```

GitLab: `.gitlab/ci/workshop-claude-review.yml` posts a review note on every MR pipeline (needs `GITLAB_ACCESS_TOKEN`). GitHub: `.github/workflows/workshop-claude-review.yml`. Alternative on either host: enable **Cursor Bugbot** for the repo in the Cursor dashboard.

Commit, push, merge to the default branch (confirm first). Existing MR/PR pipelines use their own branch's CI config, so merge the default branch into the Phase 7 or 8 agent branch (or open a fresh MR/PR), then read the review.

## 9.6 [HUMAN] Review the reviewer

Did the review agent find what they found in Phase 7/8? Anything they missed? Any noise? One line in `agent-notes.md`. If it's noisy, tighten `REVIEW.md`.

## Gate 9

- [ ] AGENTS.md has a project-specific agent section; CLAUDE.md points to it
- [ ] A second agent-evals run exists with a compare against the Phase 6 baseline
- [ ] A review agent posted at least one review

## Room Gate 9

Before the capstone the room agrees on a per-person budget. Wait for release.

---

## Phase Complete

Mark Phase 9 complete. Preview: "Phase 10 — several agents at once, and you decide what merges based on evidence."
