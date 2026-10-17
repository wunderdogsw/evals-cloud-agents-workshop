# Phase 18 — Guardrails

## Overview

Agents follow the instructions they find in the repo. You'll write an agent-facing section in AGENTS.md (and CLAUDE.md), add a review agent to every MR/PR, then re-run Phase 8's benchmark to see if your instructions changed the pass rate. Instructions you haven't measured are just hopes.

---

## 18.1 [HUMAN] Mine the notes

They re-read `agent-notes.md` (Phases 6–8) and list the 3 most common reasons agents went wrong in *their* repo: missing commands, unknown conventions, scope creep, touching evals, wrong test location…

## 18.2 [LLM] Add the agent section

```bash
pnpm workshop install <name> agents-section
```

Commands are filled from the profile. The script also makes sure `CLAUDE.md` imports `@AGENTS.md` (Claude Code reads CLAUDE.md; Cursor reads AGENTS.md) — mention it, because without it Phase 8 measured Claude without these instructions.

## 18.3 [HUMAN] Make it specific

They edit the section to address their 3 reasons from 9.1 — concrete rules, not adjectives ("Tests live next to the code in `X.test.ts`", not "write good tests"). Replace the `TODO:` line under *Boundaries*. Keep the whole section under ~40 lines: long instruction files get skimmed by agents too.

## 18.4 [LLM] Measure

Commit the AGENTS.md change on the workshop branch (the benchmark snapshots `base` commits, so the new instructions must be in the snapshot):

- **Sample tasks** (`base: "HEAD"`) → just commit; the next run picks it up.
- **Mined tasks** (`base` = old parent commits) → the old commits don't have the new AGENTS.md. Explain the trade-off and copy the new file in with `setupCommand`, e.g. `--setup "<install> && cp <abs path to new AGENTS.md> AGENTS.md && git add AGENTS.md"` (setup runs before the `eval-base` tag, so it isn't counted as the agent's diff).

Then re-run with the same agent and settings as Phase 8 (`--agent claude` or `--agent cursor`, whichever they benchmarked) and compare:

```bash
pnpm agent-evals run targets/<name> --tasks <tasks-file> --agent <claude|cursor> --setup "…" --max-budget-usd 2 --label <agent>-guarded
pnpm evals compare <agent>-baseline <agent>-guarded
```

Both tools read the same AGENTS.md (Claude via the `@AGENTS.md` import in CLAUDE.md), so if they have both, running the other agent too shows whether the instructions help across tools.

Read it like Phase 12: fixes, regressions, cost, noise (5–10 tasks is a small sample — say so).

## 18.5 [LLM] Review agent

```bash
pnpm workshop install <name> review-md
```

`REVIEW.md` tells any review agent what matters in this repo (including: flag hand edits to `cases.jsonl`, thresholds or `last-run.json`). Commit it. Then run a reviewer on the Phase 16 or 17 MR/PR — whichever they have:

- **Any tool, from the laptop:** `pnpm workshop review <name> <agent-branch>` runs Claude Code or the Cursor CLI read-only on the diff and prints the review; add `--post` to put it on the MR/PR with their `glab`/`gh` login (confirm first).
- **Cursor Bugbot:** enable it for the repo in the Cursor dashboard (*Bugbot*, per repo; works on GitLab and GitHub). It reviews every MR/PR automatically, no CI setup.

(Only where the organisation allows a model credential in CI: `ci-review` adds a Claude review job to the pipeline. Not used in this workshop.)

## 18.6 [HUMAN] Review the reviewer

Did the review agent find what they found in Phase 16/17? Anything they missed? Any noise? One line in `agent-notes.md`. If it's noisy, tighten `REVIEW.md`.

## Gate 18

- [ ] AGENTS.md has a project-specific agent section; CLAUDE.md points to it
- [ ] A second agent-evals run exists with a compare against the Phase 8 baseline
- [ ] A review agent posted at least one review

## Room Gate 18

Before the capstone the room agrees on a per-person budget. Wait for release.

---

## Phase Complete

Mark Phase 18 complete. Preview: "Phase 19 — several agents at once, and you decide what merges based on evidence."
