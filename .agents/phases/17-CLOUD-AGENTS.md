# Phase 17 — Cloud agents

## Overview

Same delegation as Phase 16, but the agent runs on someone else's machine: it clones your repo into a remote VM, works there, and pushes a branch while your laptop is closed. You'll set up the VM's build environment, delegate a task, and compare with Phase 16 on the same evidence: eval gate, hidden tests, review effort.

---

## 17.1 [LLM] Which cloud agent is available

Check and report in two lines, don't fix silently. Use whichever applies — participants may have one, both or neither:

- **Cursor cloud agents** — work with GitLab (Premium/Ultimate; self-hosted may need extra networking) and GitHub. Needs: the repo connected in the Cursor dashboard (*Integrations*, synced — facilitators set this up), a paid Cursor plan with cloud agents enabled and a spend limit.
- **Claude Code cloud sessions** (claude.ai/code, `claude --cloud "<task>"`) — **GitHub repos only**: they can't push back to GitLab. Needs the Claude GitHub App on the repo or `/web-setup`.

If neither is available for this target (e.g. GitLab and no Cursor): skip to 8.4 and run **two `pnpm workshop delegate` jobs in parallel** in two terminals instead — the lesson (delegate, walk away, review evidence) is the same; only the machine differs. Note it in `agent-notes.md`.

## 17.2 [LLM] Build environment (Cursor)

Cursor builds its environment from `.cursor/environment.json` on the **default branch**, but an agent started on a feature branch checks that branch out on top, and without a repo file Cursor uses a personal or team saved environment ([setup docs](https://cursor.com/docs/cloud-agent/setup)). We never merge to the default branch of a real repo, so:

```bash
pnpm workshop install <name> cursor-env
```

- Node targets → just an `install` command.
- Other stacks → a Dockerfile in `.cursor/` built from the same base image as CI. Edit it for the target's toolchain.

- **Real repo:** commit and push the file on the workshop branch and start the agent on that branch, or let Cursor's agent-led setup save a personal environment. Don't merge to the default branch.
- **Sample, catch-up or facilitator mirror:** committing on the default branch is fine (confirm first).

For Claude Code cloud sessions the equivalent is the environment's setup script (claude.ai/code → environment settings) — mention it if they use that path.

## 17.3 [LLM] Evals inside the VM

The agent should run `pnpm verify` and re-record if it changes the LLM feature (AGENTS.md says so). A cloud VM has no participant login, so:

- **Cursor:** add `CURSOR_API_KEY` as a cloud-agent **Secret** (cursor.com/dashboard → Cloud Agents) and `EVALS_PROVIDER=cursor`, if the team is OK with that key living in Cursor's dashboard.
- **Claude Code cloud session:** runs on the participant's Claude subscription, so `claude -p` works inside it — `EVALS_PROVIDER=claude-code`.
- **Neither:** fine. If the agent touches the feature, the gate goes red as *stale*, and the human re-records on the branch before merging. That's a legitimate workflow — say so.

## 17.4 [HUMAN] Delegate

They start the agent with a task from the backlog — ideally the same one as Phase 16, or its sibling:

- **Cursor:** Agent input → **Cloud**, pick the repo and the workshop branch `dev-days-workshop/<participant>` (or cursor.com/agents). Ask it to open an MR/PR **into the workshop branch** when done.
- **Claude Code (GitHub):** start a session at claude.ai/code on the repo, or `claude --cloud "<task>"` from `targets/<name>` while on the workshop branch; create the PR **into the workshop branch** when done.

Cloud agents push from their own machines, where the workshop push guard does not run. Before launching, check the base branch is the workshop branch; afterwards, check the MR/PR target and retarget it if needed.

While it runs: what's different from Phase 16 — someone else's VM, an environment defined in the repo, follow-ups mid-run from a browser or phone.

## 17.5 [HUMAN] Review and compare

Same review as Phase 16. Then a comparison table in `.workshop/targets/<name>/agent-notes.md`:

| | Phase 16 (laptop, `<tool>`) | Phase 17 (`<where>`, `<tool>`) |
|---|---|---|
| Eval gate | | |
| Hidden tests (sample) | | |
| Review comments needed | | |
| Scope creep? | | |
| Wall time | | |
| Would merge? | | |

Keep it honest: one task is an anecdote. Phase 18 is where you measure.

## Gate 17

- [ ] A second agent-authored MR/PR exists (cloud agent, or a parallel `delegate` if no cloud agent was available) and its eval gate ran
- [ ] The comparison table is filled in

---

## Phase Complete

Mark Phase 17 complete. Preview: "Phase 18 — the instructions you give agents are code. You'll change them and measure whether it helped."
