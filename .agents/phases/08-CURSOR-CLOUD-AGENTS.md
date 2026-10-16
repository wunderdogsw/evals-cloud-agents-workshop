# Phase 8 — Cursor cloud agents

## Overview

You'll give a similar task to a Cursor cloud agent, which clones your repo into a remote VM, works there and pushes a branch. Then you'll compare the two agents on the same evidence: eval gate, hidden tests, review effort, cost.

---

## 8.1 [LLM] Preconditions

Check and report, don't fix silently:

- The repo is connected in the Cursor dashboard (*Integrations → GitLab/GitHub*, synced). For GitLab this needs **Premium/Ultimate** (project access tokens) and was set up by facilitators. Self-hosted GitLab may need extra networking.
- The participant is on a paid Cursor plan with cloud agents enabled and a spend limit set.
- Cloud-agent **Secrets** (cursor.com/dashboard → Cloud Agents) contain `ANTHROPIC_API_KEY` if running the evals needs it.

If any is missing, tell them who to ask (facilitators) and do 8.2 meanwhile.

## 8.2 [LLM] Build environment

Cursor cloud agents read `.cursor/environment.json` from the **default branch**.

```bash
pnpm workshop install <name> cursor-env
```

- Node targets → just an `install` command.
- Other stacks → a Dockerfile in `.cursor/` built from the same base image as CI. Edit it for the target's toolchain.

Commit, push, merge to the default branch (confirm first).

## 8.3 [HUMAN] Delegate

They start a cloud agent from Cursor (Agent input → **Cloud**, pick the repo and default branch) or from cursor.com/agents, with a task from the backlog — ideally the same one Claude did in Phase 7, or its sibling. Tell the agent to open an MR/PR when done and to run the evals if it touches the LLM feature.

While it runs: explain what's different from Phase 7 — Cursor's VM vs your CI runner, environment from `environment.json` vs `.gitlab-ci.yml`/Actions, interactive follow-ups mid-run.

## 8.4 [HUMAN] Review and compare

Same review as Phase 7. Then fill in a comparison table in `.workshop/targets/<name>/agent-notes.md`:

| | Claude (Phase 7) | Cursor (Phase 8) |
|---|---|---|
| Eval gate | | |
| Hidden tests (sample) | | |
| Review comments needed | | |
| Scope creep? | | |
| Wall time | | |
| Cost (if visible) | | |
| Would merge? | | |

Keep it honest: one task is an anecdote. Phase 9 is where you measure.

## Gate 8

- [ ] A Cursor-authored MR/PR exists and its eval job ran
- [ ] The comparison table is filled in

---

## Phase Complete

Mark Phase 8 complete. Preview: "Phase 9 — the instructions you give agents are code. You'll change them and measure whether it helped."
